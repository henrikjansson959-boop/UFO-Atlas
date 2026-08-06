import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  AttributionControl,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  Map as MapLibreMap,
  type MapMouseEvent,
  MercatorCoordinate,
  NavigationControl,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapIncident } from '../data/mapIncidents';

interface IncidentGlobeCanvasProps {
  incidents: MapIncident[];
}

interface GlobeRuntime {
  layer: IncidentPointLayer;
  map: MapLibreMap;
}

const INCIDENT_LAYER_ID = 'ufo-atlas-incident-points';

const openStreetMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    'open-street-map': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'open-street-map',
      type: 'raster',
      source: 'open-street-map',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-saturation': -0.88,
        'raster-contrast': 0.3,
        'raster-brightness-min': 0.055,
        'raster-brightness-max': 0.38,
      },
    },
  ],
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Map point shader could not be created.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compilation error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

class IncidentPointLayer implements CustomLayerInterface {
  readonly id = INCIDENT_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  private buffer: WebGLBuffer | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private kindLocation = -1;
  private map: MapLibreMap | null = null;
  private matrixLocation: WebGLUniformLocation | null = null;
  private pointSizeLocation: WebGLUniformLocation | null = null;
  private positionLocation = -1;
  private program: WebGLProgram | null = null;
  private vertexCount = 0;
  private vertices = new Float32Array();

  constructor(incidents: MapIncident[]) {
    this.setIncidents(incidents);
  }

  setIncidents(incidents: MapIncident[]) {
    const vertices = new Float32Array(incidents.length * 3);
    let vertexIndex = 0;

    incidents.forEach((incident) => {
      if (!Number.isFinite(incident.latitude) || !Number.isFinite(incident.longitude)) return;
      const coordinate = MercatorCoordinate.fromLngLat([
        incident.longitude,
        incident.latitude,
      ]);
      vertices[vertexIndex * 3] = coordinate.x;
      vertices[vertexIndex * 3 + 1] = coordinate.y;
      vertices[vertexIndex * 3 + 2] = incident.layer === 'famous' ? 1 : 0;
      vertexIndex += 1;
    });

    this.vertices = vertexIndex === incidents.length
      ? vertices
      : vertices.slice(0, vertexIndex * 3);
    this.vertexCount = vertexIndex;
    this.uploadVertices();
    this.map?.triggerRepaint();
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.gl = gl;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
      uniform mat4 u_matrix;
      uniform float u_point_size;
      in vec2 a_position;
      in float a_kind;
      out float v_kind;

      void main() {
        gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
        gl_PointSize = u_point_size + a_kind * 3.4;
        v_kind = a_kind;
      }
    `);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float;
      in float v_kind;
      out vec4 frag_color;

      void main() {
        vec2 offset = gl_PointCoord - vec2(0.5);
        if (dot(offset, offset) > 0.25) discard;
        vec3 report = vec3(1.0, 0.184, 0.239);
        vec3 famous = vec3(1.0, 0.72, 0.18);
        vec3 color = mix(report, famous, v_kind);
        frag_color = vec4(color * 0.94, 0.94);
      }
    `);

    const program = gl.createProgram();
    if (!program) throw new Error('Map point program could not be created.');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? 'Unknown map point link error.';
      gl.deleteProgram(program);
      throw new Error(message);
    }

    this.program = program;
    this.positionLocation = gl.getAttribLocation(program, 'a_position');
    this.kindLocation = gl.getAttribLocation(program, 'a_kind');
    this.matrixLocation = gl.getUniformLocation(program, 'u_matrix');
    this.pointSizeLocation = gl.getUniformLocation(program, 'u_point_size');
    this.buffer = gl.createBuffer();
    this.uploadVertices();
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    if (!this.program || !this.buffer || !this.map) return;

    const pointSize = Math.min(6, Math.max(2.2, 1.55 + this.map.getZoom() * 0.28));
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(this.kindLocation);
    gl.vertexAttribPointer(this.kindLocation, 1, gl.FLOAT, false, 12, 8);
    gl.uniformMatrix4fv(this.matrixLocation, false, options.defaultProjectionData.mainMatrix);
    gl.uniform1f(this.pointSizeLocation, pointSize * window.devicePixelRatio);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.POINTS, 0, this.vertexCount);
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) {
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    this.buffer = null;
    this.gl = null;
    this.map = null;
    this.program = null;
  }

  private uploadVertices() {
    if (!this.gl || !this.buffer) return;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.STATIC_DRAW);
  }
}

function findIncidentAtPoint(
  event: MapMouseEvent,
  map: MapLibreMap,
  incidents: MapIncident[],
) {
  let closest: MapIncident | null = null;
  let closestDistanceSquared = 64;

  incidents.forEach((incident) => {
    const point = map.project([incident.longitude, incident.latitude]);
    const deltaX = point.x - event.point.x;
    const deltaY = point.y - event.point.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared < closestDistanceSquared) {
      closest = incident;
      closestDistanceSquared = distanceSquared;
    }
  });

  return closest;
}

export default function IncidentGlobeCanvas({ incidents }: IncidentGlobeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GlobeRuntime | null>(null);
  const incidentsRef = useRef(incidents);
  const [selectedIncident, setSelectedIncident] = useState<MapIncident | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialZoom = container.clientWidth >= 1600
      ? 3.32
      : container.clientWidth >= 1000
        ? 2.75
        : 1.9;
    const layer = new IncidentPointLayer(incidentsRef.current);
    const map = new MapLibreMap({
      container,
      style: openStreetMapStyle,
      center: [-97, 38],
      zoom: initialZoom,
      minZoom: 0.65,
      maxZoom: 18,
      attributionControl: false,
      renderWorldCopies: false,
      canvasContextAttributes: { antialias: true },
    });
    runtimeRef.current = { layer, map };

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(
      new AttributionControl({ compact: true, customAttribution: 'UFO Atlas' }),
      'bottom-right',
    );

    map.on('style.load', () => {
      if (!map.getLayer(INCIDENT_LAYER_ID)) map.addLayer(layer);
      container.dataset.incidentCount = String(incidentsRef.current.length);
      container.dataset.incidentLayerReady = String(Boolean(map.getLayer(INCIDENT_LAYER_ID)));
    });
    map.on('click', (event) => {
      setSelectedIncident(findIncidentAtPoint(event, map, incidentsRef.current));
    });
    map.on('error', (event) => {
      container.dataset.mapError = event.error.message;
    });

    return () => {
      runtimeRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    incidentsRef.current = incidents;
    const runtime = runtimeRef.current;
    if (runtime) {
      runtime.layer.setIncidents(incidents);
      const container = containerRef.current;
      if (container) container.dataset.incidentCount = String(incidents.length);
    }

    setSelectedIncident((selected) => (
      selected && incidents.some((incident) => incident.id === selected.id) ? selected : null
    ));
  }, [incidents]);

  return (
    <div className="incident-globe incident-globe-map">
      <div className="incident-globe-map-canvas" ref={containerRef} />
      <p className="incident-globe-hint">Drag to pan · Scroll to zoom · Roads and places from OSM</p>
      {selectedIncident ? (
        <article className="incident-globe-popup">
          <button type="button" aria-label="Close incident" onClick={() => setSelectedIncident(null)}>
            <X size={14} />
          </button>
          <span>
            {selectedIncident.layer === 'famous' ? 'Famous case' : 'Sighting'}
            {' · '}
            {selectedIncident.dateLabel}
          </span>
          <strong>{selectedIncident.title}</strong>
          <small>{selectedIncident.location}</small>
          {selectedIncident.summary ? <p>{selectedIncident.summary}</p> : null}
          <small>Source: {selectedIncident.sourceLabel}</small>
          {selectedIncident.sourceUrl ? (
            <a href={selectedIncident.sourceUrl} target="_blank" rel="noreferrer">
              Open original source
            </a>
          ) : (
            <a href="https://www.uapdrop.com/data.html" target="_blank" rel="noreferrer">
              View UAPDrop dataset
            </a>
          )}
        </article>
      ) : null}
    </div>
  );
}
