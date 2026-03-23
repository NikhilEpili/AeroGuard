import random
import time
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configuration
DB_URL = "postgresql://postgres:postgres@localhost:5432/aeroguard" # Standard dev URL
NUM_SENSORS = 100
MUMBAI_BOUNDS = {
    "lat_min": 19.0467,
    "lat_max": 19.2723,
    "lon_min": 72.7767,
    "lon_max": 72.9797
}

engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)

def generate_sensors():
    session = Session()
    print(f"Generating {NUM_SENSORS} sensors in Mumbai...")
    
    # Clear existing if needed? For now just add.
    # session.execute(text("TRUNCATE TABLE sensors CASCADE"))
    
    for i in range(NUM_SENSORS):
        lat = random.uniform(MUMBAI_BOUNDS["lat_min"], MUMBAI_BOUNDS["lat_max"])
        lon = random.uniform(MUMBAI_BOUNDS["lon_min"], MUMBAI_BOUNDS["lon_max"])
        name = f"Mumbai-Sensor-{i+1}"
        
        # Using raw SQL for PostGIS geom convenience
        query = text("""
            INSERT INTO sensors (latitude, longitude, location_name, geom)
            VALUES (:lat, :lon, :name, ST_SetSRID(ST_Point(:lon, :lat), 4326))
            RETURNING id
        """)
        session.execute(query, {"lat": lat, "lon": lon, "name": name})
    
    session.commit()
    print("Sensors generated successfully.")
    session.close()

def stream_pollution_readings():
    session = Session()
    sensor_ids = [r[0] for r in session.execute(text("SELECT id FROM sensors")).fetchall()]
    
    print(f"Streaming readings for {len(sensor_ids)} sensors...")
    
    try:
        while True:
            for sid in sensor_ids:
                pm25 = random.uniform(20, 180)
                pm10 = pm25 * 1.5
                no2 = random.uniform(10, 50)
                
                query = text("""
                    INSERT INTO pollution_readings (sensor_id, pm25, pm10, no2, timestamp)
                    VALUES (:sid, :pm25, :pm10, :no2, NOW())
                """)
                session.execute(query, {
                    "sid": sid,
                    "pm25": pm25,
                    "pm10": pm10,
                    "no2": no2
                })
            
            session.commit()
            print(f"Logged {len(sensor_ids)} readings at {datetime.now()}")
            time.sleep(10) # Log every 10 seconds for simulation
    except KeyboardInterrupt:
        print("Streaming stopped.")
    finally:
        session.close()

if __name__ == "__main__":
    # Check if sensors exist
    session = Session()
    count = session.execute(text("SELECT COUNT(*) FROM sensors")).scalar()
    session.close()
    
    if count < NUM_SENSORS:
        generate_sensors()
    
    stream_pollution_readings()
