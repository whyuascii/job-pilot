-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schema for multi-tenant isolation
CREATE SCHEMA IF NOT EXISTS jobpilot;

-- RxResume needs its own database
CREATE DATABASE rxresume;
