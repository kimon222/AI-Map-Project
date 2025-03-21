// App.jsx - Main application file
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Components
import Sidebar from './components/Sidebar';
import MapControls from './components/MapControls';
import FeatureInfo from './components/FeatureInfo';

const App = () => {
  // State variables
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedColor, setSelectedColor] = useState('#3388ff');
  const [layers, setLayers] = useState([]);
  const [activeFeature, setActiveFeature] = useState(null);
  const [activeProperties, setActiveProperties] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '', visible: false });
  const [basemap, setBasemap] = useState('osm');
  const mapRef = useRef(null);
  
  // Handle file selection
  const handleFiles = (files) => {
    // Reset selection
    const newSelectedFiles = [];
    let hasShp = false;
    let hasShx = false;
    let hasDbf = false;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (['shp', 'shx', 'dbf'].includes(extension)) {
        newSelectedFiles.push(file);
        
        if (extension === 'shp') hasShp = true;
        if (extension === 'shx') hasShx = true;
        if (extension === 'dbf') hasDbf = true;
      }
    }
    
    setSelectedFiles(newSelectedFiles);
    return { isComplete: hasShp && hasShx && hasDbf, missingFiles: getMissingFiles(hasShp, hasShx, hasDbf) };
  };
  
  const getMissingFiles = (hasShp, hasShx, hasDbf) => {
    const missingFiles = [];
    if (!hasShp) missingFiles.push('.shp');
    if (!hasShx) missingFiles.push('.shx');
    if (!hasDbf) missingFiles.push('.dbf');
    return missingFiles;
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Upload shapefile
  const uploadShapefile = async () => {
    // Show loading message
    setStatusMessage({
      text: 'Uploading shapefile...',
      type: 'loading',
      visible: true
    });
    
    try {
      const formData = new FormData();
      
      // Add all files to FormData
      for (const file of selectedFiles) {
        formData.append('files', file);
      }
      
      // Send files to backend
      const response = await fetch('http://127.0.0.1:8000/upload/', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Check if the response contains an error
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Success - add layer to map
        setStatusMessage({
          text: 'Shapefile loaded successfully!',
          type: 'success',
          visible: true
        });
        
        // Parse GeoJSON (if it's a string) or use the object directly
        const geojsonData = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Add layer to map
        addGeoJsonLayer(geojsonData);
        
        // Clear file selection
        setSelectedFiles([]);
      } else {
        throw new Error(data.error || 'Failed to upload shapefile');
      }
    } catch (error) {
      console.error('Error:', error);
      setStatusMessage({
        text: `Error: ${error.message}`,
        type: 'error',
        visible: true
      });
    } finally {
      // Hide status message after 5 seconds
      setTimeout(() => {
        setStatusMessage(prev => ({ ...prev, visible: false }));
      }, 5000);
    }
  };
  
  // Add GeoJSON layer
  const addGeoJsonLayer = (geojsonData) => {
    // Create a unique name for the layer
    const layerName = `Layer ${layers.length + 1}`;
    
    // Create new layer
    const newLayer = {
      id: Date.now(),
      name: layerName,
      color: selectedColor,
      data: geojsonData,
      visible: true
    };
    
    // Add to layers
    setLayers(prevLayers => [...prevLayers, newLayer]);
  };
  
  // Toggle layer visibility
  const toggleLayerVisibility = (layerId, visible) => {
    setLayers(prevLayers => 
      prevLayers.map(layer => 
        layer.id === layerId ? { ...layer, visible } : layer
      )
    );
  };
  
  // Feature click handler
  const onFeatureClick = (e, layerId) => {
    // Reset active feature if clicking on a different one
    if (activeFeature && activeFeature.layerId !== layerId) {
      setActiveFeature(null);
    }
    
    // Set new active feature
    setActiveFeature({
      layerId,
      featureId: e.target.feature.id || Math.random().toString(36).substring(7)
    });
    
    // Show properties
    setActiveProperties(e.target.feature.properties);
  };
  
  // Clear selection on map click
  const onMapClick = () => {
    setActiveFeature(null);
    setActiveProperties(null);
  };
  
  // MapUpdater component to handle map actions
  const MapUpdater = ({ layers, activeFeature }) => {
    const map = useMap();
    
    useEffect(() => {
      // Add map click handler
      map.on('click', onMapClick);
      
      return () => {
        map.off('click', onMapClick);
      };
    }, [map]);
    
    // Fit bounds when new layers are added
    useEffect(() => {
      if (layers.length > 0) {
        const lastLayer = layers[layers.length - 1];
        try {
          // Create a temporary GeoJSON layer to get bounds
          const tempLayer = L.geoJSON(lastLayer.data);
          if (tempLayer.getBounds().isValid()) {
            map.fitBounds(tempLayer.getBounds());
          }
        } catch (error) {
          console.error("Error fitting bounds:", error);
        }
      }
    }, [layers.length]);
    
    return null;
  };
  
  // GeoJSON style function
  const getLayerStyle = (feature, layer, isActive, color) => {
    if (isActive) {
      return {
        weight: 4,
        color: '#555',
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.7
      };
    } else {
      return {
        weight: 2,
        color: color,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.3
      };
    }
  };
  
  return (
    <div className="container">
      <header>
        <h1>GIS Shapefile Visualizer</h1>
        <p className="description">Upload and visualize shapefiles on an interactive map</p>
      </header>
      
      <div className="app-container">
        <Sidebar 
          selectedFiles={selectedFiles}
          handleFiles={handleFiles}
          formatFileSize={formatFileSize}
          uploadShapefile={uploadShapefile}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          layers={layers}
          toggleLayerVisibility={toggleLayerVisibility}
          statusMessage={statusMessage}
        />
        
        <div className="map-container">
          <MapContainer
            center={[0, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef}
          >
            {/* Base layers */}
            {basemap === 'osm' && (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            )}
            {basemap === 'satellite' && (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              />
            )}
            {basemap === 'topo' && (
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
              />
            )}
            
            {/* GeoJSON Layers */}
            {layers.filter(layer => layer.visible).map(layer => (
              <GeoJSON
                key={layer.id}
                data={layer.data}
                style={(feature) => getLayerStyle(
                  feature,
                  null,
                  activeFeature && activeFeature.layerId === layer.id,
                  layer.color
                )}
                onEachFeature={(feature, leafletLayer) => {
                  leafletLayer.on({
                    click: (e) => {
                      // Stop propagation to prevent map click
                      L.DomEvent.stopPropagation(e);
                      onFeatureClick(e, layer.id);
                    }
                  });
                }}
              />
            ))}
            
            <MapUpdater layers={layers} activeFeature={activeFeature} />
            <MapControls basemap={basemap} setBasemap={setBasemap} />
          </MapContainer>
          
          {activeProperties && (
            <FeatureInfo properties={activeProperties} />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;