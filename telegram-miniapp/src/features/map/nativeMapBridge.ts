import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { MapBusiness } from './InteractiveMap';

export interface RabbittyMapPluginInterface {
  showMap(): Promise<{ success: boolean }>;
  hideMap(): Promise<{ success: boolean }>;
  setBusinesses(options: { businesses: MapBusiness[] }): Promise<{ count: number }>;
  centerOn(options: { lat: number; lng: number; radiusKm?: number }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'onBusinessSelected',
    listenerFunc: (data: { businessId: string }) => void
  ): Promise<PluginListenerHandle>;
}

export const RabbittyMap = registerPlugin<RabbittyMapPluginInterface>('RabbittyMap');
