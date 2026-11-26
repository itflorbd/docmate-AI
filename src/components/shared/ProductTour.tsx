'use client';

export interface TourStep {
  selector: string;
  titleKey: string;
  descKey: string;
}

export function startProductTour() {
  // Permanently disabled
}

export function getStepsForPanel(): TourStep[] {
  return [];
}

/**
 * Product Tour Overlay permanently removed.
 */
export function ProductTour() {
  return null;
}
