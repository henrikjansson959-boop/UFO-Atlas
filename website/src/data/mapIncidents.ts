import type { PublicSighting } from '../types';

export type IncidentLayer = 'famous' | 'sighting';
export type MapScope = 'all' | 'sightings' | 'famous';

export interface MapIncident {
  id: string;
  title: string;
  location: string;
  dateLabel: string;
  year: number | null;
  latitude: number;
  longitude: number;
  layer: IncidentLayer;
  status: string;
  summary: string;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceReference?: string | null;
  coordinatePrecision?: string | null;
}

export const famousIncidents: MapIncident[] = [
  {
    id: 'rendlesham-forest',
    title: 'Rendlesham Forest incident',
    location: 'United Kingdom',
    dateLabel: 'December 1980',
    year: 1980,
    latitude: 52.09,
    longitude: 1.43,
    layer: 'famous',
    status: 'Disputed',
    summary: 'A series of reported lights and unusual events near RAF Woodbridge.',
    sourceLabel: 'The UK National Archives',
    sourceUrl: 'https://www.nationalarchives.gov.uk/ufos/',
  },
  {
    id: 'roswell',
    title: 'Roswell incident',
    location: 'New Mexico, United States',
    dateLabel: 'July 1947',
    year: 1947,
    latitude: 33.39,
    longitude: -104.52,
    layer: 'famous',
    status: 'Disputed',
    summary: 'Debris recovered near Roswell became one of the most widely discussed UFO stories.',
    sourceLabel: 'US National Archives',
    sourceUrl: 'https://www.archives.gov/research/military/air-force/ufos',
  },
  {
    id: 'washington-1952',
    title: 'Washington, D.C. sightings',
    location: 'Washington, D.C., United States',
    dateLabel: 'July 1952',
    year: 1952,
    latitude: 38.91,
    longitude: -77.04,
    layer: 'famous',
    status: 'Disputed',
    summary: 'Radar returns and visual reports prompted Air Force investigation during two weekends.',
    sourceLabel: 'Project Blue Book, US National Archives',
    sourceUrl: 'https://www.archives.gov/research/military/air-force/ufos',
  },
  {
    id: 'socorro',
    title: 'Socorro encounter',
    location: 'New Mexico, United States',
    dateLabel: 'April 1964',
    year: 1964,
    latitude: 34.06,
    longitude: -106.89,
    layer: 'famous',
    status: 'Unresolved',
    summary: 'Police officer Lonnie Zamora reported a landed object and nearby occupants.',
    sourceLabel: 'Project Blue Book, US National Archives',
    sourceUrl: 'https://www.archives.gov/research/military/air-force/ufos',
  },
  {
    id: 'tehran-1976',
    title: 'Tehran UFO incident',
    location: 'Tehran, Iran',
    dateLabel: 'September 1976',
    year: 1976,
    latitude: 35.69,
    longitude: 51.31,
    layer: 'famous',
    status: 'Unresolved',
    summary: 'Iranian Air Force crews reported visual and instrument effects during an aerial encounter.',
    sourceLabel: 'US National Archives UAP records',
    sourceUrl: 'https://www.archives.gov/research/topics/uaps',
  },
  {
    id: 'belgian-wave',
    title: 'Belgian UFO wave',
    location: 'Belgium',
    dateLabel: '1989–1990',
    year: 1989,
    latitude: 50.85,
    longitude: 4.35,
    layer: 'famous',
    status: 'Disputed',
    summary: 'A prolonged series of reports, including triangular lights and an Air Force response.',
    sourceLabel: 'Belgian Air Force historical reporting',
    sourceUrl: 'https://www.belgianairforce.be/',
  },
  {
    id: 'ariel-school',
    title: 'Ariel School encounter',
    location: 'Ruwa, Zimbabwe',
    dateLabel: 'September 1994',
    year: 1994,
    latitude: -17.86,
    longitude: 31.24,
    layer: 'famous',
    status: 'Disputed',
    summary: 'Schoolchildren reported seeing an unusual object and figures near their school.',
    sourceLabel: 'Case source register pending',
    sourceUrl: 'https://ufo.uap.gov/',
  },
  {
    id: 'phoenix-lights',
    title: 'Phoenix Lights',
    location: 'Arizona, United States',
    dateLabel: 'March 1997',
    year: 1997,
    latitude: 33.45,
    longitude: -112.07,
    layer: 'famous',
    status: 'Disputed',
    summary: 'Thousands reported lights across Arizona; later flare activity explains part of the event.',
    sourceLabel: 'Case source register pending',
    sourceUrl: 'https://www.archives.gov/research/topics/uaps',
  },
  {
    id: 'nimitz-2004',
    title: 'USS Nimitz “Tic Tac” encounter',
    location: 'Pacific Ocean, west of Baja California',
    dateLabel: 'November 2004',
    year: 2004,
    latitude: 31.0,
    longitude: -117.0,
    layer: 'famous',
    status: 'Unresolved',
    summary: 'US Navy personnel reported unusual objects during training operations.',
    sourceLabel: 'US Department of Defense',
    sourceUrl: 'https://www.aaro.mil/UAP-Cases/Official-UAP-Imagery/',
  },
];

const sourceLabels: Record<string, string> = {
  hatch: 'Hatch UAP Database',
  us_nara_bluebook: 'US National Archives — Project Blue Book',
  fr_cnes_geipan: 'CNES GEIPAN',
  uk_national_archives: 'The UK National Archives',
};

function formatObservedDate(observedAt: string | null): { dateLabel: string; year: number | null } {
  if (!observedAt) return { dateLabel: 'Date unknown', year: null };
  const date = new Date(observedAt);
  if (Number.isNaN(date.getTime())) return { dateLabel: 'Date unknown', year: null };

  return {
    dateLabel: new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date),
    year: date.getUTCFullYear(),
  };
}

export function sightingToMapIncident(sighting: PublicSighting): MapIncident {
  const observed = formatObservedDate(sighting.observedAt);
  return {
    id: sighting.id,
    title: sighting.title,
    location: sighting.location,
    dateLabel: observed.dateLabel,
    year: observed.year,
    latitude: sighting.latitude,
    longitude: sighting.longitude,
    layer: 'sighting',
    status: 'Public sighting record',
    summary: sighting.summary,
    sourceLabel: sourceLabels[sighting.sourceKey] ?? sighting.sourceKey,
    sourceUrl: sighting.sourceUrl,
    sourceReference: sighting.sourceReference,
    coordinatePrecision: sighting.coordinatePrecision,
  };
}
