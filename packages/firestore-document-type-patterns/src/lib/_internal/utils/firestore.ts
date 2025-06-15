import { serverTimestamp, GeoPoint } from 'firebase/firestore'

export const getServerTimestamp = () => serverTimestamp()
export const getGeoPoint = (latitude: number, longitude: number): GeoPoint => new GeoPoint(latitude, longitude)
