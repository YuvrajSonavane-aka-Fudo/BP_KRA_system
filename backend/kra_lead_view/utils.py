from typing import Any
from collections import defaultdict
from django.db import connection

def get_assessment_progress_data(cycle_id: int, caller_id: int, is_hr: bool, employee_id_filter: str | None) -> list[dict[str, Any]]:
    """
    Fetch complex nested assessment progress data using raw SQL.
    Replaced massive ORM select_related/prefetch_related query with parameterized 
    raw SQL queries for readability and performance.
    """
    params_ekc = [cycle_id]
    
    # Query 1: Fetch EmployeeKRACycle and Employee details
    query_ekc = """
        SELECT 
            ekc.id AS ekc_id, ekc.employee_id, ekc.status, ekc.stage_id, s.name AS stage_name,
            e.first_name, e.last_name, 
            d.department_name, l.name AS level_name,
            m.first_name AS manager_first_name, m.last_name AS manager_last_name
        FROM employee_kra_cycle ekc
        INNER JOIN employee e ON ekc.employee_id = e.id
        LEFT JOIN department d ON e.department_id = d.id
        LEFT JOIN level l ON e.level_id = l.id
        LEFT JOIN employee m ON e.manager_id = m.id
        LEFT JOIN stage s ON ekc.stage_id = s.id
        WHERE ekc.kra_cycle_id = %s
    """
    
    if not is_hr:
        query_ekc += " AND e.manager_id = %s"
        params_ekc.append(caller_id)
        
    if employee_id_filter:
        query_ekc += " AND ekc.employee_id = %s"
        params_ekc.append(employee_id_filter)
        
    employees_map = {}
    with connection.cursor() as cursor:
        cursor.execute(query_ekc, params_ekc)
        for row in cursor.fetchall():
            ekc_id = row[0]
            employees_map[ekc_id] = {
                "employee_id": row[1],
                "full_name": f"{row[5]} {row[6]}",
                "employee_kra_cycle_id": ekc_id,
                "status": row[2],
                "current_stage_id": row[3],
                "current_stage_name": row[4],
                "department": row[7],
                "level": row[8],
                "manager_name": f"{row[9]} {row[10]}" if row[9] else None,
                "kras": []
            }
            
    if not employees_map:
        return []
        
    ekc_ids = list(employees_map.keys())
    placeholders = ', '.join(['%s'] * len(ekc_ids))
    
    # Fetch Category weightages
    category_map = defaultdict(dict)
    query_cats = f"""
        SELECT ekcc.employee_kra_cycle_id, ekcc.category_id, c.name, ekcc.weightage
        FROM employee_kra_cycle_category ekcc
        LEFT JOIN category c ON ekcc.category_id = c.id
        WHERE ekcc.employee_kra_cycle_id IN ({placeholders})
    """
    with connection.cursor() as cursor:
        cursor.execute(query_cats, ekc_ids)
        for row in cursor.fetchall():
            ekc_id, cat_id, cat_name, weightage = row
            category_map[ekc_id][cat_id] = {
                "name": cat_name,
                "weightage": weightage
            }
            
    # Query 2: Fetch EmployeeKRALevel details
    query_kras = f"""
        SELECT 
            ekl.employee_kra_cycle_id, ekl.id AS ekl_id,
            kl.kra_id, k.name AS kra_name, k.category_id, kc.name AS category_name,
            ekl.self_rating_id, sr.rating AS self_rating_val, ekl.self_comment,
            ekl.lead_rating_id, lr.rating AS lead_rating_val, ekl.lead_comment,
            ekl.progress_notes, ekl.lead_progress_notes, ekl.description_by_lead,
            ekl.help_and_assistance_required
        FROM employee_kra_level ekl
        LEFT JOIN kra_level kl ON ekl.kra_level_id = kl.id
        LEFT JOIN kra k ON kl.kra_id = k.id
        LEFT JOIN category kc ON k.category_id = kc.id
        LEFT JOIN rating sr ON ekl.self_rating_id = sr.id
        LEFT JOIN rating lr ON ekl.lead_rating_id = lr.id
        WHERE ekl.employee_kra_cycle_id IN ({placeholders})
    """
    with connection.cursor() as cursor:
        cursor.execute(query_kras, ekc_ids)
        for row in cursor.fetchall():
            ekc_id = row[0]
            cat_id = row[4]
            weightage = category_map.get(ekc_id, {}).get(cat_id, {}).get("weightage")
            
            kra_data = {
                "employee_kra_level_id": row[1],
                "kra_id": row[2],
                "kra_name": row[3],
                "category_name": row[5],
                "weightage": weightage,
                "self_rating_id": row[6],
                "self_rating": row[7],
                "self_comment": row[8],
                "lead_rating_id": row[9],
                "lead_rating": row[10],
                "lead_comment": row[11],
                "progress_notes": row[12],
                "lead_progress_notes": row[13],
                "description_by_lead": row[14],
                "help_and_assistance_required": row[15]
            }
            employees_map[ekc_id]["kras"].append(kra_data)
            
    return list(employees_map.values())
