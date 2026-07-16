"""
OR-Tools VRP solver core.

Pure function — no HTTP concerns here. Shared by:
  - api/optimize.py       (Vercel Python serverless function, production)
  - api/optimize_cli.py   (stdin/stdout CLI, spawned by server.ts for local dev)

Input/output shapes deliberately mirror src/utils/optimizer.ts's
optimizeRoutes() so the OR-Tools-backed OptimizationProvider is a drop-in
replacement for the local JS heuristic:

  solve({ stops, vehicles, depot, trafficZones, config })
    -> { optimizedStops, optimizedVehicles }
"""
import math

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

GRID_UNITS_PER_KM = 1 / 0.22  # matches the JS heuristic's implicit grid scale


def _distance(a, b):
    """Distance between two points. Prefers real haversine distance (scaled
    to roughly the same magnitude as the app's abstract 0-100 grid units) if
    both points have geocoded lat/lng; falls back to Euclidean grid distance.
    """
    a_lat, a_lng = a.get('lat'), a.get('lng')
    b_lat, b_lng = b.get('lat'), b.get('lng')
    if a_lat is not None and a_lng is not None and b_lat is not None and b_lng is not None:
        r = 6371.0
        lat1, lat2 = math.radians(a_lat), math.radians(b_lat)
        dlat = math.radians(b_lat - a_lat)
        dlng = math.radians(b_lng - a_lng)
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
        km = 2 * r * math.asin(math.sqrt(h))
        return km * GRID_UNITS_PER_KM
    return math.hypot(a['x'] - b['x'], a['y'] - b['y'])


def _empty_metrics():
    return {'totalDistance': 0, 'totalTime': 0, 'loadUsed': 0, 'delayCount': 0, 'totalCost': 0}


def _fallback_greedy(stops, vehicles, depot):
    """Last-resort assignment when the VRP is infeasible under hard capacity
    constraints (e.g. total demand exceeds total fleet capacity). Mirrors the
    JS heuristic's own forced-assignment fallback: distribute stops to
    whichever vehicle currently has the least load, ignore capacity if
    necessary, and evaluate sequential metrics.
    """
    routes = {v['id']: [] for v in vehicles}
    loads = {v['id']: 0 for v in vehicles}

    for stop in stops:
        target = min(vehicles, key=lambda v: loads[v['id']])
        routes[target['id']].append(stop)
        loads[target['id']] += stop['volume']

    optimized_stops = []
    optimized_vehicles = []

    for vehicle in vehicles:
        route = routes[vehicle['id']]
        speed = vehicle.get('speed') or 1.5
        current_time = vehicle['shiftStart']
        current_pos = depot
        total_distance = 0.0
        delay_count = 0

        for i, stop in enumerate(route):
            dist = _distance(current_pos, stop)
            total_distance += dist
            arrival = current_time + dist / speed
            service_start = max(arrival, stop['timeWindowStart'])
            is_delayed = service_start > stop['timeWindowEnd']
            if is_delayed:
                delay_count += 1
            optimized_stops.append({
                **stop,
                'assignedVehicleId': vehicle['id'],
                'stopSequence': i,
                'eta': round(arrival),
                'arrivalTime': round(arrival),
                'status': 'Delayed' if is_delayed else 'Pending',
            })
            current_time = service_start + stop['serviceDuration']
            current_pos = stop

        return_dist = _distance(current_pos, depot)
        total_distance += return_dist
        total_time = current_time + return_dist / speed - vehicle['shiftStart']
        load_used = sum(s['volume'] for s in route)

        optimized_vehicles.append({
            **vehicle,
            'status': 'Active' if route else 'Idle',
            'metrics': {
                'totalDistance': round(total_distance, 1),
                'totalTime': round(total_time),
                'loadUsed': load_used,
                'delayCount': delay_count,
                'totalCost': round(total_distance * vehicle['costPerMile'] + (total_time / 60) * vehicle['costPerHour'], 2),
            },
        })

    return {'optimizedStops': optimized_stops, 'optimizedVehicles': optimized_vehicles}


def solve(payload):
    stops = payload['stops']
    vehicles = payload['vehicles']
    depot = payload['depot']
    config = payload.get('config') or {}

    n_stops = len(stops)
    n_vehicles = len(vehicles)

    if n_stops == 0 or n_vehicles == 0:
        return {
            'optimizedStops': [
                {**s, 'assignedVehicleId': None, 'stopSequence': None, 'eta': None, 'arrivalTime': None, 'status': 'Pending'}
                for s in stops
            ],
            'optimizedVehicles': [{**v, 'status': 'Idle', 'metrics': _empty_metrics()} for v in vehicles],
        }

    # Node 0 = depot; nodes 1..n_stops = stops, in the same order as `stops`.
    locations = [depot] + stops
    n_nodes = len(locations)
    distance_matrix = [[_distance(locations[i], locations[j]) for j in range(n_nodes)] for i in range(n_nodes)]

    manager = pywrapcp.RoutingIndexManager(n_nodes, n_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # ── Capacity dimension ──────────────────────────────────────────────
    demands = [0] + [s['volume'] for s in stops]

    def demand_callback(from_index):
        return demands[manager.IndexToNode(from_index)]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    vehicle_capacities = [v['capacity'] for v in vehicles]
    routing.AddDimensionWithVehicleCapacity(demand_callback_index, 0, vehicle_capacities, True, 'Capacity')

    # ── Per-vehicle time + cost callbacks (speed/cost vary by vehicle) ──
    time_callback_indices = []
    cost_callback_indices = []

    for vehicle in vehicles:
        speed = vehicle.get('speed') or 1.5
        cost_per_mile = vehicle['costPerMile']
        cost_per_hour = vehicle['costPerHour']

        def make_time_callback(speed=speed):
            def time_callback(from_index, to_index):
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                travel = distance_matrix[from_node][to_node] / speed
                service = 0 if to_node == 0 else stops[to_node - 1]['serviceDuration']
                return int(round(travel + service))
            return time_callback

        def make_cost_callback(speed=speed, cost_per_mile=cost_per_mile, cost_per_hour=cost_per_hour):
            def cost_callback(from_index, to_index):
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                dist = distance_matrix[from_node][to_node]
                time_min = dist / speed
                cost = dist * cost_per_mile + (time_min / 60) * cost_per_hour
                return int(round(cost * 100))
            return cost_callback

        time_callback_indices.append(routing.RegisterTransitCallback(make_time_callback()))
        cost_callback_indices.append(routing.RegisterTransitCallback(make_cost_callback()))

    for vehicle_id, cb in enumerate(cost_callback_indices):
        routing.SetArcCostEvaluatorOfVehicle(cb, vehicle_id)

    if config.get('minimizeVehicles'):
        for vehicle_id in range(n_vehicles):
            routing.SetFixedCostOfVehicle(30000, vehicle_id)

    # ── Time dimension with time windows (soft lateness penalty) ───────
    routing.AddDimensionWithVehicleTransits(time_callback_indices, 24 * 60, 24 * 60, False, 'Time')
    time_dimension = routing.GetDimensionOrDie('Time')

    time_window_weight = config.get('timeWindowWeight', 5)
    for node in range(1, n_nodes):
        stop = stops[node - 1]
        index = manager.NodeToIndex(node)
        # Hard lower bound: don't start before the window opens (waits via slack).
        # Loose hard upper bound (+1 day): lateness is a soft penalty, not infeasible,
        # matching the app's "Delayed" status concept rather than a hard rule.
        time_dimension.CumulVar(index).SetRange(int(stop['timeWindowStart']), int(stop['timeWindowEnd']) + 24 * 60)
        time_dimension.SetCumulVarSoftUpperBound(index, int(stop['timeWindowEnd']), int(time_window_weight * 50))

    for vehicle_id, vehicle in enumerate(vehicles):
        start_index = routing.Start(vehicle_id)
        time_dimension.CumulVar(start_index).SetRange(int(vehicle['shiftStart']), int(vehicle['shiftStart']))

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_params.time_limit.FromSeconds(8)

    solution = routing.SolveWithParameters(search_params)

    if solution is None:
        return _fallback_greedy(stops, vehicles, depot)

    return _extract_solution(manager, routing, solution, stops, vehicles, depot, distance_matrix, time_dimension)


def _extract_solution(manager, routing, solution, stops, vehicles, depot, distance_matrix, time_dimension):
    optimized_stops = []
    optimized_vehicles = []
    assigned_ids = set()

    for vehicle_id, vehicle in enumerate(vehicles):
        index = routing.Start(vehicle_id)
        sequence = 0
        total_distance = 0.0
        delay_count = 0
        route_stop_ids = []

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            next_node = manager.IndexToNode(next_index)
            total_distance += distance_matrix[node][next_node]

            if node != 0:  # skip depot
                stop = stops[node - 1]
                cumul = solution.Min(time_dimension.CumulVar(index))
                departure = cumul
                arrival = departure - stop['serviceDuration']
                is_delayed = arrival > stop['timeWindowEnd']
                if is_delayed:
                    delay_count += 1

                optimized_stops.append({
                    **stop,
                    'assignedVehicleId': vehicle['id'],
                    'stopSequence': sequence,
                    'eta': round(arrival),
                    'arrivalTime': round(arrival),
                    'status': 'Delayed' if is_delayed else 'Pending',
                })
                assigned_ids.add(stop['id'])
                route_stop_ids.append(stop['id'])
                sequence += 1

            index = next_index

        end_cumul = solution.Min(time_dimension.CumulVar(routing.End(vehicle_id)))
        start_cumul = solution.Min(time_dimension.CumulVar(routing.Start(vehicle_id)))
        total_time = end_cumul - start_cumul
        load_used = sum(s['volume'] for s in stops if s['id'] in route_stop_ids)

        optimized_vehicles.append({
            **vehicle,
            'status': 'Active' if route_stop_ids else 'Idle',
            'metrics': {
                'totalDistance': round(total_distance, 1),
                'totalTime': round(total_time),
                'loadUsed': load_used,
                'delayCount': delay_count,
                'totalCost': round(
                    total_distance * vehicle['costPerMile'] + (total_time / 60) * vehicle['costPerHour'], 2
                ),
            },
        })

    # Any stop OR-Tools somehow left unassigned (shouldn't happen — every
    # node belongs to exactly one route in a standard CVRPTW) stays Pending.
    for stop in stops:
        if stop['id'] not in assigned_ids:
            optimized_stops.append({
                **stop, 'assignedVehicleId': None, 'stopSequence': None, 'eta': None,
                'arrivalTime': None, 'status': 'Pending',
            })

    return {'optimizedStops': optimized_stops, 'optimizedVehicles': optimized_vehicles}
