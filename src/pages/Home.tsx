// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Paper, Typography, AppBar, Toolbar, Snackbar, Alert } from '@mui/material';
import L from 'leaflet';

const truckIcon = new L.Icon({
  iconUrl: '/icons8-truck.gif', // или '/truck.svg' если используете PNG/SVG
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

export default function Home() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [adminRoute, setAdminRoute] = useState<[number, number][]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [inputId, setInputId] = useState('');
  const [routeError, setRouteError] = useState(false);

  // Получить ID транспорта из Preferences
  useEffect(() => {
    Preferences.get({ key: 'vehicle_id' }).then(({ value }) => {
      if (value) setVehicleId(value);
    });
  }, []);

  // Сохранить ID транспорта
  const handleSaveId = async () => {
    if (inputId) {
      await Preferences.set({ key: 'vehicle_id', value: inputId });
      setVehicleId(inputId);
    }
  };

  // Получение маршрута из backend
  useEffect(() => {
    fetch('http://192.168.223.150:3002/api/admin-route')
      .then(res => res.json())
      .then(data => {
        setAdminRoute(data.map((point: {lat: number, lng: number}) => [point.lat, point.lng]));
        setRouteError(false);
      })
      .catch(err => {
        setRouteError(true);
        setAdminRoute([]);
      });
  }, []);

  // Отправка текущей локации на сервер и отслеживание позиции
  useEffect(() => {
    if (!vehicleId) return;
    let watchId: string | undefined;

    const sendPosition = (latitude: number, longitude: number) => {
      fetch('http://192.168.223.150:3002/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          lat: latitude,
          lng: longitude
        })
      });
    };

    const startTracking = async () => {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
      // Получаем начальную позицию
      const coordinates = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = coordinates.coords;
      setPosition([latitude, longitude]);
      sendPosition(latitude, longitude);
      // Следим за изменением позиции
      watchId = await Geolocation.watchPosition({}, (pos, err) => {
        if (pos) {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
          sendPosition(latitude, longitude);
        }
      });
    };
    startTracking();
    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [vehicleId]);

  if (!vehicleId) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, minWidth: 320 }}>
          <Typography variant="h6" gutterBottom>Введите ID транспорта</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <input
              style={{ flex: 1, fontSize: 16, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              placeholder="ID транспорта"
              value={inputId}
              onChange={e => setInputId(e.target.value)}
            />
            <button
              style={{ padding: '8px 16px', borderRadius: 4, background: '#1976d2', color: '#fff', border: 'none', fontWeight: 600 }}
              onClick={handleSaveId}
            >Сохранить</button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>GPS-Трекер</Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>ID: {vehicleId}</Typography>
          <button
            style={{ padding: '6px 14px', borderRadius: 4, background: '#fff', color: '#1976d2', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => { Preferences.remove({ key: 'vehicle_id' }); setVehicleId(null); }}
          >Сменить ID</button>
        </Toolbar>
      </AppBar>
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        mt: 4
      }}>
        <Paper elevation={4} sx={{ width: '95vw', maxWidth: 600, height: '75vh', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={position || [38.5651931, 68.7976046]} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {adminRoute.length > 0 && (
              <>
                <Polyline positions={adminRoute} color="red" />
                <Marker position={adminRoute[0]}>
                  <Popup>Старт маршрута</Popup>
                </Marker>
                <Marker position={adminRoute[adminRoute.length - 1]}>
                  <Popup>Конец маршрута</Popup>
                </Marker>
              </>
            )}
            {position && (
              <Marker position={position} icon={truckIcon}>
                <Popup>Ваше текущее местоположение</Popup>
              </Marker>
            )}
          </MapContainer>
        </Paper>
      </Box>
      <Snackbar open={routeError} autoHideDuration={6000} onClose={() => setRouteError(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setRouteError(false)} severity="error" sx={{ width: '100%' }}>
          Не удалось загрузить маршрут с сервера
        </Alert>
      </Snackbar>
    </Box>
  );
}