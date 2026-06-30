from typing import Optional, Any
from django.db import models


class Stage(models.Model):
    """
    stage
    Master list of KRA cycle stages (1–5).
    """
    name: Optional[str] = models.CharField(max_length=255, null=True, blank=True)
    description: Optional[str] = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'stage'

    def __str__(self) -> str:
        return self.name or str(self.id)

class Level(models.Model):
    """
    level
    Employee seniority levels (e.g. Dev-01, Dev-02).
    """
    name: Optional[str] = models.CharField(max_length=255, null=True, blank=True)
    description: Optional[str] = models.CharField(max_length=255, null=True, blank=True)
    min_experience: Optional[int] = models.IntegerField(null=True, blank=True)
    max_experience: Optional[int] = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'level'

    def __str__(self) -> str:
        return self.name or str(self.id)
    
class Rating(models.Model):
    """
    rating
    Numeric rating scale used for self & lead assessment.
    """
    rating: Optional[int] = models.IntegerField(null=True, blank=True)
    description: Optional[str] = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'rating'

    def __str__(self) -> str:
        return f'{self.rating} – {self.description}'

class KRACategory(models.Model):
    """
    kra_category
    Grouping for KRAs (e.g. Core Development, Behavioural).
    """
    name: Optional[str] = models.CharField(max_length=255, null=True, blank=True)
    description: Optional[str] = models.CharField(max_length=255, null=True, blank=True)
    is_standard: Optional[bool] = models.BooleanField(null=True, blank=True)
    

    class Meta:
        db_table = 'kra_category'

    def __str__(self) -> str:
        return self.name or str(self.id)

class Role(models.Model):
    """
    role
    Application roles (e.g. bbw.hr, bbw.emp).
    created_by / updated_by are FKs to employee; declared as raw
    IntegerField to avoid circular-import issues — swap to ForeignKey
    once you are comfortable with the model graph.
    """
    # id is now varchar (was auto-increment int). Stores the role code.
    id: str = models.CharField(max_length=50, primary_key=True)
    name: Optional[str] = models.CharField(max_length=255, null=True, blank=True)
    description: Optional[str] = models.CharField(max_length=255, null=True, blank=True)
    created: Optional[Any] = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated: Optional[Any] = models.DateTimeField(null=True, blank=True)
    # FK to employee — using raw int to avoid circular import.
    # Swap to: created_by = models.ForeignKey('Employee', null=True, ...)
    created_by: Optional[int] = models.IntegerField(null=True, blank=True)
    updated_by: Optional[int] = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'role'

    def __str__(self) -> str:
        return self.name or str(self.id)
    
class Department(models.Model):
    """
    department model
    """
    department_name: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    #FK to employee - string reference used because employee is defined after
    department_lead: Optional[models.ForeignKey] = models.ForeignKey(
        'Employee',
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'department_lead_id',
        related_name = 'led_departments',
    )
    description: Optional[str] = models.TextField(null = True, blank = True)
    is_deleted: bool = models.BooleanField(default = False)
    
    class Meta : 
        db_table = 'department'
        
    def __str__(self) -> str:
        return self.department_name or str(self.id)
    
class Employee(models.Model):
    """
    employee
    Note : id is NOT auto generated in the DB (no IDENTITY)
    We must supply it explicitly
    """
    #plain PK - no auto incre in source schema
    id: int = models.IntegerField(primary_key = True)
    first_name: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    last_name: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    email: str = models.CharField(max_length = 255 , unique = True)
    active: bool = models.BooleanField(default = False)
    department: Optional[models.ForeignKey] = models.ForeignKey(
        Department ,
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'department_id',
        related_name = 'employees',
    )
    title: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    password: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    manager: Optional[models.ForeignKey] = models.ForeignKey(
        'self',
        null = True , blank = True,
        on_delete = models.SET_NULL ,
        db_column = 'manager_id',
        related_name = 'direct_reports',
    )
    previous_manager: Optional[models.ForeignKey] = models.ForeignKey(
        'self',
        null = True , blank = True,
        on_delete = models.SET_NULL ,
        db_column = 'previous_manager_id',
        related_name = 'previous_reports',
    )
    team: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    team_id: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    #'role' column in DB is now a varchar FK to role (id).
    role: Optional[models.ForeignKey] = models.ForeignKey(
        Role , 
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'role',
        related_name = 'employees',
        
    )
    is_owner: bool = models.BooleanField(default = False)
    level: Optional[models.ForeignKey] = models.ForeignKey(
        Level ,
        null = True , blank = True ,
        on_delete = models.SET_NULL,
        db_column = 'level_id',
        related_name = 'employees',
    )
    
    class Meta :
        db_table = 'employee'
    
    def __str__(self) -> str:
        return f'{self.first_name} {self.last_name} ({self.email})'
    
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False
    
class EmployeeRole(models.Model):
    '''
        employee_role
        many to many bridge between employee and role with an extra 'name' denormalized column.
    '''
    employee: Optional[models.ForeignKey] = models.ForeignKey(
        Employee ,
        null = True , blank = True,
        on_delete = models.CASCADE,
        db_column = 'employee_id',
        related_name = 'employee_roles',
    )
    
    role: Optional[models.ForeignKey] = models.ForeignKey(
        Role , 
        null = True , blank = True ,
        on_delete = models.SET_NULL,
        db_column = 'role_id',
        related_name = 'employee_roles',
    )
    name: Optional[str] = models.CharField(max_length = 255 , null = True , blank = True)
    
    class Meta :
        db_table = 'employee_role'
        
    def __str__(self) -> str:
        return self.name or str(self.id)
    
class KRA(models.Model):
    """
    kra
    Master kra definition.
    """
    name: Optional[str] = models.TextField(null = True , blank = True)
    description: Optional[str] = models.TextField(null = True , blank = True)
    is_standard: Optional[bool] = models.BooleanField(null = True , blank = True)
    category: Optional[models.ForeignKey] = models.ForeignKey(
        KRACategory ,
        null = True , blank = True ,
        on_delete = models.SET_NULL,
        db_column = 'category_id',
        related_name = 'kras',
        
    )
    class Meta:
        db_table = 'kra'
    
    def __str__(self) -> str:
        return (self.name or '')[:60]
    
class KRALevel(models.Model):
    '''
        kra_level . a specific kra scoped to a seniority level.
    '''
    kra: Optional[models.ForeignKey] = models.ForeignKey(
        KRA ,
        null = True ,
        blank = True,
        on_delete = models.CASCADE,
        db_column = 'kra_id',
        related_name = 'kra_levels',
    )
    
    level: Optional[models.ForeignKey] = models.ForeignKey(
        Level ,
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'level_id',
        related_name = 'kra_levels',
    )
    name: Optional[str] = models.TextField(null=True, blank=True)
    category: Optional[models.ForeignKey] = models.ForeignKey(
        KRACategory, null=True, blank=True,
        on_delete=models.SET_NULL,
        db_column='category_id',
        related_name='kra_levels'
        )
    
    class Meta:
        db_table = 'kra_level'
        
    def __str__(self) -> str:
        return (self.name or '')[:60]
    
class KRACycle (models.Model):
    """
    kra_cycle a performance review cycle (draft -> active -> closed)
    """
    name: str = models.CharField(max_length = 255)
    #not null in db
    description: Optional[str] = models.TextField(null = True , blank = True)
    start_date: Optional[Any] = models.DateTimeField(null = True, blank = True)
    end_date: Optional[Any] = models.DateTimeField(null = True, blank = True)
    status: str = models.CharField(max_length = 50) #not null in db
    stage: Optional[models.ForeignKey] = models.ForeignKey(
        Stage,
        null = True, blank = True ,
        on_delete = models.SET_NULL,
        db_column = 'stage_id',
        related_name = 'kra_cycles',
    )
    is_deleted: Optional[bool] = models.BooleanField(null = True , blank = True)
    
    class Meta :
        db_table = 'kra_cycle'
    
    def __str__(self) -> str:
        return f'{self.name} ({self.status})'
    
class KRACycleStage(models.Model):
    '''
    kra_cycle_stage
    date windows for each stage within a cycle
    '''
    kra_cycle: Optional[models.ForeignKey] = models.ForeignKey(
        KRACycle,
        null = True , blank = True,
        on_delete = models.CASCADE,
        db_column = 'kra_cycle_id',
        related_name = 'cycle_stages',
    )
    
    stage: Optional[models.ForeignKey] = models.ForeignKey(
        Stage ,
        null = True , blank = True,
        on_delete = models.CASCADE,
        db_column = 'stage_id',
        related_name = 'cycle_stages',
    )
    
    start_date: Optional[Any] = models.DateTimeField(null = True , blank = True)
    end_date: Optional[Any] = models.DateTimeField(null = True , blank = True)
    is_deleted: Optional[bool] = models.BooleanField(null = True , blank = True)
    
    class Meta :
        db_table = 'kra_cycle_stage'
    
    def __str__(self) -> str:
        return f'Cycle {self.kra_cycle_id} - stage {self.stage_id}' 
    
class EmployeeKRACycle(models.Model):
    """
    employee_kra_cycle
    Central pivot : links an emploee to a kra cycle
    """
    employee: Optional[models.ForeignKey] = models.ForeignKey(
        Employee,
        null = True , blank = True,
        on_delete = models.CASCADE,
        db_column = 'employee_id',
        related_name = 'kra_cycles',
        
    )
    kra_cycle: Optional[models.ForeignKey] = models.ForeignKey(
        KRACycle,
        null = True , blank = True,
        on_delete = models.CASCADE,
        db_column = 'kra_cycle_id',
        related_name = 'employee_cycles',
    )
    status: Optional[str] = models.CharField(max_length = 50 , null = True , blank = True)
    stage: Optional[models.ForeignKey] = models.ForeignKey(
        Stage , 
        null = True, blank = True ,
        on_delete = models.SET_NULL,
        db_column = 'stage_id',
        related_name = 'employee_kra_cycles',
    )
    
    is_date_based: Optional[bool] = models.BooleanField(null = True , blank = True)
    employee_manager: Optional[models.ForeignKey] = models.ForeignKey(
        Employee,
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'employee_manager_id',
        related_name = 'managed_kra_cycles',
    )
    #employee_level is an FK to level(id), column name 'employee_level'
    employee_level: Optional[models.ForeignKey] = models.ForeignKey(
        Level,
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'employee_level',
        related_name = 'employee_kra_cycles',
    )
    is_stage_overridden: bool = models.BooleanField(default=False)
    class Meta:
        db_table = 'employee_kra_cycle'
    
    def __str__(self) -> str:
        return f'Employee {self.employee_id} - cycle {self.kra_cycle_id}'
 
class EmployeeKRACycleCategory(models.Model):
    '''
    employee_kra_cycle_category
    Category weightage split for an employee within an cycle
    '''
    employee_kra_cycle: Optional[models.ForeignKey] = models.ForeignKey(
        EmployeeKRACycle,
        null = True , blank  = True,
        on_delete = models.CASCADE,
        db_column = 'employee_kra_cycle_id',
        related_name = 'categories',
    )
    
    category: Optional[models.ForeignKey] = models.ForeignKey(
        KRACategory,
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'category_id',
        related_name = 'employee_cycle_categories',
    )
    
    #stored as varchar in DB (ex : "30") keep as charfield to match schema
    weightage: Optional[str] = models.CharField(max_length = 10 , null = True , blank = True)
    assigned_by_role: Optional[str] = models.CharField(max_length=50, null=True, blank=True)
    
    class Meta:
        db_table = 'employee_kra_cycle_category'
    
    def __str__(self) -> str:
        return f'EKC {self.employee_kra_cycle_id} - cat {self.category_id} ({self.weightage}%)'
 
class EmployeeKRALevel(models.Model):
    """
    employee_kra_level
    one row per kra assigned to an employee in a cycle
    holds self assessment lead rating , progress notes and desc
    """
    employee: Optional[models.ForeignKey] = models.ForeignKey(
        Employee,
        null = True , blank = True,
        on_delete = models.CASCADE,
        db_column = 'employee_id',
        related_name = 'kra_level_rows',
    )
    
    kra_level: Optional[models.ForeignKey] = models.ForeignKey(
        KRALevel ,
        null = True, blank = True,
        on_delete = models.CASCADE,
        db_column = 'kra_level_id',
        related_name = 'employee_kra_levels',
    )
    
    description_by_lead: Optional[str] = models.TextField(null = True , blank = True)
    help_and_assistance_required: Optional[str] = models.TextField(null = True , blank = True)
    self_rating: Optional[models.ForeignKey] = models.ForeignKey(
        Rating,
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'self_rating_id',
        related_name = 'self_assessments',
    )
    self_comment: Optional[str] = models.TextField(null = True , blank = True)
    lead_rating: Optional[models.ForeignKey] = models.ForeignKey(
        Rating ,
        null = True , blank = True,
        on_delete = models.SET_NULL,
        db_column = 'lead_rating_id',
        related_name = 'lead_assessments',
    )
    
    lead_comment: Optional[str] = models.TextField(null = True, blank = True)
    progress_notes: Optional[str] = models.TextField(null = True , blank = True)
    employee_kra_cycle: Optional[models.ForeignKey] = models.ForeignKey(
        EmployeeKRACycle,
        null = True , blank = True,
        on_delete = models.CASCADE , 
        db_column = 'employee_kra_cycle_id',
        related_name = 'kra_level_rows',
    )
    lead_progress_notes: Optional[str] = models.TextField(null = True , blank = True)
    assigned_by_role: Optional[str] = models.CharField(max_length=50, null=True, blank=True)
    
    class Meta :
        db_table = 'employee_kra_level'
        
    def __str__(self) -> str:
        return f'EKL {self.id} - Employee {self.employee_id} / KRALevel {self.kra_level_id}'
    
class AuditLog(models.Model):
    """
    audit_log
    Tracks every significant action made by any employee.
    """
    employee: Optional[models.ForeignKey] = models.ForeignKey(
        Employee,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        db_column='employee_id',
        related_name='audit_logs',
    )
    action: str = models.CharField(max_length=100)           # e.g. 'CYCLE_CREATED'
    entity: str = models.CharField(max_length=100)           # e.g. 'KRACycle'
    entity_id: Optional[int] = models.IntegerField(null=True, blank=True) # e.g. cycle.id
    old_data: Optional[Any] = models.JSONField(null=True, blank=True)    # state BEFORE the change
    new_data: Optional[Any] = models.JSONField(null=True, blank=True)    # state AFTER the change
    timestamp: Any = models.DateTimeField(auto_now_add=True)
    ip_address: Optional[str] = models.CharField(max_length=50, null=True, blank=True)
 
    class Meta:
        db_table = 'audit_log'
 
    def __str__(self) -> str:
        return f'{self.employee_id} → {self.action} on {self.entity}:{self.entity_id} at {self.timestamp}'
    
class EmployeeKRACycleStage(models.Model):
    """Per-employee stage date overrides. Created only when an employee is sent back."""
    employee_kra_cycle: models.ForeignKey = models.ForeignKey(
        EmployeeKRACycle,
        on_delete=models.CASCADE,
        related_name='stage_overrides'
    )
    stage: models.ForeignKey = models.ForeignKey(Stage, on_delete=models.CASCADE)
    start_date: Any = models.DateField()
    end_date: Any = models.DateField()
 
    class Meta:
        unique_together = ('employee_kra_cycle', 'stage')