CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS parcels;
CREATE TABLE parcels (
  id INTEGER PRIMARY KEY,
  owner TEXT,
  geom geometry(MULTIPOLYGON, 4326)
);

-- Insert sample parcels (wrap polygons with ST_Multi to match MULTIPOLYGON column)
INSERT INTO parcels (id, owner, geom) VALUES
(1001,'Owner A', ST_Multi(ST_GeomFromText('POLYGON((46.67 24.71,46.675 24.71,46.675 24.714,46.67 24.714,46.67 24.71))',4326))),
(1002,'Owner B', ST_Multi(ST_GeomFromText('POLYGON((46.678 24.712,46.684 24.712,46.684 24.717,46.678 24.717,46.678 24.712))',4326))),
(1003,'Owner C', ST_Multi(ST_GeomFromText('POLYGON((46.686 24.715,46.692 24.715,46.692 24.72,46.686 24.72,46.686 24.715))',4326)));

-- Spatial index
CREATE INDEX parcels_geom_gix ON parcels USING gist (geom);