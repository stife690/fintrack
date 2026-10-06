-- Catálogo cerrado de categorías (RN-02). Las claves (key) coinciden con las del
-- contrato de API v2.0 (GET /categories). 'sin_clasificar' NO es una categoría:
-- es un valor de transacciones.origen cuando categoria_id queda en NULL.

INSERT INTO categorias (id, key, nombre, tipo) VALUES
  (1,  'alimentacion',          'Alimentación',        'gasto'),
  (2,  'transporte',            'Transporte',          'gasto'),
  (3,  'vivienda',              'Vivienda',            'gasto'),
  (4,  'servicios_publicos',    'Servicios públicos',  'gasto'),
  (5,  'salud',                 'Salud',               'gasto'),
  (6,  'educacion',             'Educación',           'gasto'),
  (7,  'entretenimiento',       'Entretenimiento',     'gasto'),
  (8,  'ropa_accesorios',       'Ropa y accesorios',   'gasto'),
  (9,  'tecnologia',            'Tecnología',          'gasto'),
  (10, 'ahorro_inversion',      'Ahorro/Inversión',    'gasto'),
  (11, 'otros',                 'Otros',               'gasto'),
  (12, 'salario',               'Salario',             'ingreso'),
  (13, 'freelance',             'Freelance',           'ingreso'),
  (14, 'inversion_rendimientos','Inversión y rendimientos','ingreso'),
  (15, 'otros_ingresos',        'Otros ingresos',      'ingreso');
