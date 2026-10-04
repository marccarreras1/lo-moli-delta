import { Component, type ReactNode } from 'react';
import type * as THREE from 'three';

/** Referencia al renderer para exportar PNG. */
export const glRef: { current: THREE.WebGLRenderer | null; scene: THREE.Scene | null; camera: THREE.Camera | null } = {
  current: null, scene: null, camera: null,
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export class ViewerErrorBoundary extends Component<{ fallback: (err: Error) => ReactNode; children: ReactNode; onError?: () => void }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.err ? this.props.fallback(this.state.err) : this.props.children;
  }
}

