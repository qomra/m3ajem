from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/m3ajem_gateway"
)

# Create engine with connection pooling for production
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # Base connections to keep open
    max_overflow=30,       # Extra connections when busy (total max: 50)
    pool_timeout=30,       # Seconds to wait for available connection
    pool_recycle=1800,     # Recycle connections every 30 min (avoid stale)
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
