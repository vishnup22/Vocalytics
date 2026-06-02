INSERT INTO regions (id, name, continent) VALUES
  (1, 'Germany',        'Europe'),
  (2, 'France',         'Europe'),
  (3, 'United Kingdom', 'Europe'),
  (4, 'Spain',          'Europe'),
  (5, 'United States',  'North America'),
  (6, 'Canada',         'North America');

INSERT INTO categories (id, name) VALUES
  (1, 'Electronics'),
  (2, 'Apparel'),
  (3, 'Home & Kitchen'),
  (4, 'Sports & Outdoors'),
  (5, 'Beauty'),
  (6, 'Toys & Games');

SELECT setval('regions_id_seq', (SELECT MAX(id) FROM regions));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
