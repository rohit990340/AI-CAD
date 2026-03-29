/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Grid, 
  Stage, 
  Environment, 
  ContactShadows, 
  TransformControls,
  Html,
  useGLTF,
  Center,
  Float,
  Text,
  Edges,
  Line,
  GizmoHelper,
  GizmoViewport,
  Billboard
} from '@react-three/drei';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { Physics, useBox, useSphere, useCylinder } from '@react-three/cannon';
import { SUBTRACTION, INTERSECTION, ADDITION, Brush, Evaluator } from 'three-bvh-csg';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { 
  Box, 
  Cpu, 
  FileText, 
  Layers, 
  Play, 
  Settings, 
  Download, 
  MessageSquare, 
  ChevronRight,
  Activity,
  Maximize2,
  Minimize2,
  RefreshCw,
  Terminal as TerminalIcon,
  Upload,
  Pencil,
  CircuitBoard,
  Grid as GridIcon,
  MousePointer2,
  Move,
  RotateCw,
  Scale,
  Ruler,
  Trash2,
  Eye,
  EyeOff,
  Palette,
  Plus,
  Minus,
  Maximize,
  Search,
  Command,
  Undo2,
  Redo2,
  Grid3X3,
  Video,
  BoxSelect,
  Share2,
  Zap,
  Tag,
  Target,
  Image as ImageIcon,
  Dna,
  Menu,
  X,
  ChevronLeft,
  CircleDot
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import Markdown from 'react-markdown';
import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import { GLTFLoader } from 'three-stdlib';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type TransformMode = 'translate' | 'rotate' | 'scale' | null;

interface Modifier {
  type: 'array' | 'mirror' | 'subdivision';
  count?: number;
  offset?: [number, number, number];
  enabled: boolean;
}

interface SceneObject {
  id: string;
  name: string;
  type: 'box' | 'sphere' | 'cylinder' | 'torus' | 'mesh' | 'stroke' | 'pcb';
  params: any;
  color: string;
  metalness: number;
  roughness: number;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  mesh?: THREE.Group | THREE.Mesh;
  textureUrl?: string;
  isPhysicsEnabled?: boolean;
  stats?: {
    vertices: number;
    faces: number;
  };
  points?: [number, number, number][]; // For strokes
  pcbData?: {
    layers: { id: string; name: string; color: string; visible: boolean; type: 'copper' | 'silk' | 'mask' }[];
    components: { id: string; name: string; position: [number, number]; type: string }[];
  };
  modifiers?: Modifier[];
}

interface Annotation {
  id: string;
  objectId: string;
  text: string;
  position: [number, number, number];
}

interface AnalysisResult {
  volume: number;
  surfaceArea: number;
  materialEfficiency: number;
  structuralIntegrity: string;
  advantages: string[];
  disadvantages: string[];
  modifications: string[];
  summary: string;
  blenderStats?: {
    vertices: number;
    faces: number;
  };
}

// --- Constants ---
const THEMES = [
  { id: 'cyberpunk', name: 'Cyberpunk', bg: '#050505', card: 'rgba(10, 10, 15, 0.7)', cyan: '#00f3ff', magenta: '#ff00ff', lime: '#00ff00', border: 'rgba(0, 243, 255, 0.2)' },
  { id: 'blender-dark', name: 'Blender Dark', bg: '#393939', card: '#2d2d2d', cyan: '#e87d0d', magenta: '#444444', lime: '#5680c1', border: '#1d1d1d' },
  { id: 'blender-light', name: 'Blender Light', bg: '#b3b3b3', card: '#cfcfcf', cyan: '#e87d0d', magenta: '#808080', lime: '#5680c1', border: '#999999' },
  { id: 'autocad', name: 'AutoCAD Classic', bg: '#000000', card: '#1e1e1e', cyan: '#ffffff', magenta: '#ff0000', lime: '#00ff00', border: '#333333' },
  { id: 'minimalist', name: 'Minimalist', bg: '#ffffff', card: '#f5f5f5', cyan: '#000000', magenta: '#666666', lime: '#999999', border: '#e0e0e0' },
  { id: 'matrix', name: 'Matrix', bg: '#000000', card: '#001100', cyan: '#00ff00', magenta: '#004400', lime: '#008800', border: '#003300' },
  { id: 'solarized-dark', name: 'Solarized Dark', bg: '#002b36', card: '#073642', cyan: '#268bd2', magenta: '#d33682', lime: '#859900', border: '#586e75' },
  { id: 'solarized-light', name: 'Solarized Light', bg: '#fdf6e3', card: '#eee8d5', cyan: '#268bd2', magenta: '#d33682', lime: '#859900', border: '#93a1a1' },
  { id: 'nord', name: 'Nord', bg: '#2e3440', card: '#3b4252', cyan: '#88c0d0', magenta: '#b48ead', lime: '#a3be8c', border: '#4c566a' },
  { id: 'dracula', name: 'Dracula', bg: '#282a36', card: '#44475a', cyan: '#8be9fd', magenta: '#ff79c6', lime: '#50fa7b', border: '#6272a4' },
  { id: 'monokai', name: 'Monokai', bg: '#272822', card: '#3e3d32', cyan: '#66d9ef', magenta: '#f92672', lime: '#a6e22e', border: '#49483e' },
  { id: 'gruvbox', name: 'Gruvbox', bg: '#282828', card: '#3c3836', cyan: '#83a598', magenta: '#d3869b', lime: '#b8bb26', border: '#504945' },
  { id: 'oceanic', name: 'Oceanic', bg: '#1b2b34', card: '#343d46', cyan: '#6699cc', magenta: '#c594c5', lime: '#99c794', border: '#4f5b66' },
  { id: 'forest', name: 'Forest', bg: '#1a2421', card: '#2d3b36', cyan: '#7fb3d5', magenta: '#d98880', lime: '#52be80', border: '#455a64' },
  { id: 'midnight', name: 'Midnight', bg: '#00040d', card: '#000c1f', cyan: '#007bff', magenta: '#6610f2', lime: '#28a745', border: '#001a33' },
  { id: 'sunset', name: 'Sunset', bg: '#2c1e1e', card: '#4a2c2c', cyan: '#ffcc33', magenta: '#ff6633', lime: '#ff9933', border: '#5c3d3d' },
  { id: 'lavender', name: 'Lavender', bg: '#2c2c3e', card: '#3e3e5e', cyan: '#a29bfe', magenta: '#fd79a8', lime: '#55efc4', border: '#4b4b7b' },
  { id: 'industrial', name: 'Industrial', bg: '#222222', card: '#333333', cyan: '#ffcc00', magenta: '#ff6600', lime: '#999999', border: '#444444' },
  { id: 'retro', name: 'Retro Terminal', bg: '#000000', card: '#000000', cyan: '#33ff33', magenta: '#33ff33', lime: '#33ff33', border: '#33ff33' },
  { id: 'paper', name: 'Paper', bg: '#f0f0f0', card: '#ffffff', cyan: '#0000ff', magenta: '#ff0000', lime: '#008000', border: '#cccccc' },
];

// --- 3D Components ---
const MeasurementLabels = ({ obj }: { obj: SceneObject }) => {
  const { width: baseW, height: baseH, depth: baseD } = obj.params.dimensions || { width: 0, height: 0, depth: 0 };
  if (baseW === 0 && baseH === 0 && baseD === 0) return null;

  // The labels are inside a group that already has obj.scale applied.
  // However, we want the displayed values to reflect the actual world scale.
  const worldW = baseW * obj.scale[0];
  const worldH = baseH * obj.scale[1];
  const worldD = baseD * obj.scale[2];

  const labelStyle = "bg-black/90 text-[8px] px-1.5 py-0.5 rounded border border-white/20 whitespace-nowrap font-mono flex items-center gap-1 shadow-[0_0_10px_rgba(0,0,0,0.5)]";
  
  return (
    <group>
      {/* Width Label (X) */}
      <Html position={[baseW / 2, 0, 0]} center distanceFactor={10}>
        <div className={cn(labelStyle, "text-cyber-cyan border-cyber-cyan/40")}>
          <Move className="w-2 h-2" /> W: {worldW.toFixed(3)}
        </div>
      </Html>
      {/* Height Label (Y) */}
      <Html position={[0, baseH / 2, 0]} center distanceFactor={10}>
        <div className={cn(labelStyle, "text-cyber-magenta border-cyber-magenta/40")}>
          <RotateCw className="w-2 h-2" /> H: {worldH.toFixed(3)}
        </div>
      </Html>
      {/* Depth Label (Z) */}
      <Html position={[0, 0, baseD / 2]} center distanceFactor={10}>
        <div className={cn(labelStyle, "text-cyber-lime border-cyber-lime/40")}>
          <Scale className="w-2 h-2" /> D: {worldD.toFixed(3)}
        </div>
      </Html>

      {/* Bounding Box Edges */}
      <mesh scale={[baseW, baseH, baseD]}>
        <boxGeometry />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#ffffff" opacity={0.3} transparent />
      </mesh>
    </group>
  );
};

const PreviewModel = ({ obj }: { obj: SceneObject }) => {
  const material = (
    <meshStandardMaterial 
      color={obj.color} 
      metalness={obj.metalness} 
      roughness={obj.roughness} 
    />
  );

  const geometry = (() => {
    switch (obj.type) {
      case 'box': return <boxGeometry args={[obj.params.width || 1, obj.params.height || 1, obj.params.depth || 1]} />;
      case 'sphere': return <sphereGeometry args={[obj.params.radius || 0.7, 32, 32]} />;
      case 'cylinder': return <cylinderGeometry args={[obj.params.radius || 0.5, obj.params.radius || 0.5, obj.params.height || 1.5, 32]} />;
      case 'torus': return <torusGeometry args={[obj.params.radius || 0.7, obj.params.tube || 0.2, 16, 100]} />;
      default: return null;
    }
  })();

  if (obj.type === 'mesh' && obj.mesh) {
    return (
      <group scale={obj.scale}>
        <primitive object={obj.mesh.clone()} />
        <MeasurementLabels obj={obj} />
      </group>
    );
  }

  return (
    <group scale={obj.scale}>
      <mesh>
        {geometry}
        {material}
      </mesh>
      <MeasurementLabels obj={obj} />
    </group>
  );
};

const ModelPreview = ({ obj }: { obj: SceneObject | null }) => {
  if (!obj) return (
    <div className="h-48 flex flex-col items-center justify-center text-[10px] text-white/20 italic bg-black/40 rounded border border-white/5 uppercase tracking-[0.2em] gap-3">
      <Box className="w-8 h-8 opacity-10" />
      <span>No Object Selected</span>
    </div>
  );

  return (
    <div className="relative aspect-video w-full bg-black/60 rounded border border-white/10 overflow-hidden group/preview shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="px-1.5 py-0.5 bg-cyber-cyan/20 rounded text-[7px] font-bold text-cyber-cyan uppercase tracking-widest border border-cyber-cyan/30 backdrop-blur-md">
          Model Preview
        </div>
        <div className="px-1.5 py-0.5 bg-black/60 rounded text-[7px] font-mono text-white/40 border border-white/10 backdrop-blur-md">
          {obj.name}
        </div>
      </div>
      
          <Canvas shadows camera={{ position: [4, 4, 4], fov: 35 }}>
            <Suspense fallback={null}>
              <color attach="background" args={['#080808']} />
              <Environment preset="city" />
              <ambientLight intensity={0.4} />
              <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
              <Center top>
                <PreviewModel obj={obj} />
              </Center>
              <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
              <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10} blur={2} far={4.5} />
              
              <GizmoHelper alignment="bottom-right" margin={[40, 40]}>
                <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
              </GizmoHelper>
            </Suspense>
          </Canvas>

          <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1">
            {obj.stats && (
              <div className="px-2 py-1 bg-black/60 rounded border border-white/10 backdrop-blur-md flex flex-col gap-0.5">
                <div className="flex justify-between gap-4 text-[7px] font-mono">
                  <span className="text-white/30 uppercase">Vertices</span>
                  <span className="text-cyber-cyan">{obj.stats.vertices.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-4 text-[7px] font-mono">
                  <span className="text-white/30 uppercase">Faces</span>
                  <span className="text-cyber-cyan">{obj.stats.faces.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

      <div className="absolute bottom-3 right-3 z-10 flex gap-1">
        <div className="p-1 bg-black/60 rounded border border-white/10 text-white/40 hover:text-cyber-cyan transition-colors cursor-help" title="Auto-rotating preview">
          <RefreshCw className="w-3 h-3 animate-spin-slow" />
        </div>
      </div>
    </div>
  );
};

// --- Drawing System ---
const DrawingSystem = ({ 
  isDrawingMode, 
  currentStroke, 
  setCurrentStroke, 
  onFinishStroke,
  brushColor,
  brushSize,
  drawOnSurface
}: { 
  isDrawingMode: boolean; 
  currentStroke: [number, number, number][]; 
  setCurrentStroke: React.Dispatch<React.SetStateAction<[number, number, number][]>>; 
  onFinishStroke: (points: [number, number, number][]) => void;
  brushColor: string;
  brushSize: number;
  drawOnSurface: boolean;
}) => {
  const { viewport, mouse, camera, raycaster, scene } = useThree();
  const isDrawing = useRef(false);

  const getPoint = () => {
    if (drawOnSurface) {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const validIntersect = intersects.find(i => i.object.type === 'Mesh' && i.object.name !== 'drawing-plane');
      if (validIntersect) {
        const p = validIntersect.point;
        return [p.x, p.y, p.z] as [number, number, number];
      }
    }
    
    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = 10;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    return [pos.x, pos.y, pos.z] as [number, number, number];
  };

  const handlePointerDown = (e: any) => {
    if (!isDrawingMode) return;
    e.stopPropagation();
    isDrawing.current = true;
    const point = getPoint();
    setCurrentStroke([point]);
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawingMode || !isDrawing.current) return;
    e.stopPropagation();
    const point = getPoint();
    setCurrentStroke(prev => [...prev, point]);
  };

  const handlePointerUp = (e: any) => {
    if (!isDrawingMode || !isDrawing.current) return;
    e.stopPropagation();
    isDrawing.current = false;
    if (currentStroke.length > 1) {
      onFinishStroke(currentStroke);
    }
    setCurrentStroke([]);
  };

  return (
    <>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh 
          name="drawing-plane"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          visible={true}
        >
          <planeGeometry args={[viewport.width * 10, viewport.height * 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Billboard>
      
      {isDrawingMode && (
        <mesh position={[getPoint()[0], getPoint()[1], getPoint()[2]]}>
          <ringGeometry args={[brushSize * 0.01, brushSize * 0.01 + 0.01, 32]} />
          <meshBasicMaterial color={brushColor} transparent opacity={0.5} depthTest={false} />
        </mesh>
      )}
    </>
  );
};

// --- PCB Viewer ---
const PCBViewer = ({ obj }: { obj: SceneObject }) => {
  if (!obj.pcbData) return null;

  return (
    <group>
      {/* Base Board */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[obj.params.dimensions.width, obj.params.dimensions.height, obj.params.dimensions.depth]} />
        <meshStandardMaterial color={obj.color} roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Layers */}
      {obj.pcbData.layers.map((layer, idx) => (
        layer.visible && (
          <mesh key={layer.id} position={[0, obj.params.dimensions.height / 2 + 0.01 + (idx * 0.001), 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[obj.params.dimensions.width - 0.2, obj.params.dimensions.depth - 0.2]} />
            <meshStandardMaterial 
              color={layer.color} 
              transparent 
              opacity={layer.type === 'silk' ? 0.8 : 0.4} 
              roughness={0.5}
            />
          </mesh>
        )
      ))}

      {/* Components */}
      {obj.pcbData.components.map(comp => (
        <group key={comp.id} position={[comp.position[0], obj.params.dimensions.height / 2 + 0.1, comp.position[1]]}>
          <mesh castShadow>
            {comp.type === 'ic' ? (
              <boxGeometry args={[0.8, 0.2, 0.8]} />
            ) : (
              <boxGeometry args={[0.2, 0.1, 0.4]} />
            )}
            <meshStandardMaterial color="#333333" />
          </mesh>
          <Html distanceFactor={5} position={[0, 0.3, 0]}>
            <div className="px-1 bg-black/60 text-white text-[6px] rounded border border-white/20 whitespace-nowrap">
              {comp.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

const Shape = ({ 
  obj, 
  isSelected, 
  isXray,
  shadingMode,
  faceOrientation,
  onSelect,
  onMount
}: { 
  obj: SceneObject; 
  isSelected: boolean; 
  isXray: boolean;
  shadingMode: 'wireframe' | 'solid' | 'material';
  faceOrientation: boolean;
  onSelect: (id: string) => void;
  onMount: (id: string, mesh: any) => void;
}) => {
  const meshRef = useRef<any>(null);
  
  // Physics Hook
  const [physicsRef, api] = useBox(() => ({
    mass: obj.isPhysicsEnabled ? 1 : 0,
    position: obj.position,
    rotation: obj.rotation,
    args: obj.type === 'box' ? [obj.params.width || 1, obj.params.height || 1, obj.params.depth || 1] : [1, 1, 1],
    type: obj.isPhysicsEnabled ? 'Dynamic' : 'Static'
  }), meshRef);

  useEffect(() => {
    if (meshRef.current) {
      onMount(obj.id, meshRef.current);
    }
    if (obj.type === 'mesh' && obj.mesh) {
      obj.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.transparent = isXray;
          child.material.opacity = isXray ? 0.3 : 1;
          child.material.wireframe = isSelected ? false : (obj.params.wireframe || false);
        }
      });
    }
  }, [obj.id, onMount, obj.mesh, isXray, isSelected, obj.params.wireframe]);

  if (!obj.visible) return null;

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(obj.id);
  };

  const texture = obj.textureUrl ? new THREE.TextureLoader().load(obj.textureUrl) : null;

  const material = faceOrientation ? (
    <meshNormalMaterial side={THREE.DoubleSide} />
  ) : (
    <meshStandardMaterial 
      color={shadingMode === 'solid' ? '#888888' : obj.color} 
      metalness={shadingMode === 'material' ? obj.metalness : 0} 
      roughness={shadingMode === 'material' ? obj.roughness : 1} 
      emissive={isSelected ? obj.color : '#000000'}
      emissiveIntensity={isSelected ? 0.2 : 0}
      wireframe={shadingMode === 'wireframe' || (isSelected ? false : (obj.params.wireframe || false))}
      transparent={isXray}
      opacity={isXray ? 0.3 : 1}
      map={shadingMode === 'material' ? texture : null}
    />
  );

  const arrayMod = obj.modifiers?.find(m => m.type === 'array' && m.enabled);
  const mirrorMod = obj.modifiers?.find(m => m.type === 'mirror' && m.enabled);
  const subMod = obj.modifiers?.find(m => m.type === 'subdivision' && m.enabled);
  
  const instances = [];
  
  const renderGeometry = () => {
    const segments = subMod ? (subMod.count || 1) * 32 : 32;
    switch (obj.type) {
      case 'box': return <boxGeometry args={[obj.params.width || 1, obj.params.height || 1, obj.params.depth || 1]} />;
      case 'sphere': return <sphereGeometry args={[obj.params.radius || 0.7, segments, segments]} />;
      case 'cylinder': return <cylinderGeometry args={[obj.params.radius || 0.5, obj.params.radius || 0.5, obj.params.height || 1.5, segments]} />;
      case 'torus': return <torusGeometry args={[obj.params.radius || 0.7, obj.params.tube || 0.2, segments / 2, segments]} />;
      default: return null;
    }
  };

  const renderContent = (keyPrefix = '') => {
    if (obj.type === 'mesh' && obj.mesh) {
      return <primitive object={obj.mesh.clone()} />;
    }
    return (
      <mesh>
        {renderGeometry()}
        {material}
      </mesh>
    );
  };

  if (arrayMod && arrayMod.count) {
    for (let i = 0; i < arrayMod.count; i++) {
      const offset = arrayMod.offset || [0, 0, 0];
      instances.push(
        <group key={`array-${i}`} position={[offset[0] * i, offset[1] * i, offset[2] * i]}>
          {renderContent(`array-${i}`)}
        </group>
      );
    }
  } else {
    instances.push(<group key="base">{renderContent('base')}</group>);
  }

  const finalInstances = [...instances];
  if (mirrorMod) {
    instances.forEach((inst, idx) => {
      finalInstances.push(
        <group key={`mirror-${idx}`} scale={[-1, 1, 1]}>
          {inst}
        </group>
      );
    });
  }

  const [boxRef] = useBox(() => ({ 
    mass: obj.isPhysicsEnabled ? 1 : 0, 
    position: obj.position, 
    rotation: obj.rotation,
    args: [obj.params.width || 1, obj.params.height || 1, obj.params.depth || 1]
  }), meshRef);

  const [sphereRef] = useSphere(() => ({ 
    mass: obj.isPhysicsEnabled ? 1 : 0, 
    position: obj.position, 
    rotation: obj.rotation,
    args: [obj.params.radius || 0.7]
  }), meshRef);

  const [cylinderRef] = useCylinder(() => ({ 
    mass: obj.isPhysicsEnabled ? 1 : 0, 
    position: obj.position, 
    rotation: obj.rotation,
    args: [obj.params.radius || 0.5, obj.params.radius || 0.5, obj.params.height || 1.5, 32]
  }), meshRef);

  const activePhysicsRef = obj.type === 'box' ? boxRef : obj.type === 'sphere' ? sphereRef : obj.type === 'cylinder' ? cylinderRef : meshRef;

  if (obj.type === 'stroke' && obj.points && obj.points.length > 1) {
    return (
      <group position={obj.position} rotation={obj.rotation} scale={obj.scale}>
        <Line 
          points={obj.points} 
          color={obj.color} 
          lineWidth={obj.params.lineWidth || 2} 
          onClick={handleClick}
        />
      </group>
    );
  }

  if (obj.type === 'pcb') {
    return (
      <group position={obj.position} rotation={obj.rotation} scale={obj.scale} onClick={handleClick}>
        <PCBViewer obj={obj} />
        {isSelected && <Edges scale={1.01} threshold={15} color="#00f3ff" />}
        {isSelected && <MeasurementLabels obj={obj} />}
      </group>
    );
  }

  if ((arrayMod && arrayMod.enabled) || (mirrorMod && mirrorMod.enabled)) {
    return (
      <group position={obj.position} rotation={obj.rotation} scale={obj.scale} onClick={handleClick}>
        {finalInstances}
        {isSelected && <Edges scale={1.01} threshold={15} color="#00f3ff" />}
        {isSelected && <MeasurementLabels obj={obj} />}
      </group>
    );
  }

  if (obj.type === 'mesh' && obj.mesh) {
    return (
      <group position={obj.position} rotation={obj.rotation} scale={obj.scale}>
        <primitive 
          ref={activePhysicsRef}
          object={obj.mesh} 
          onClick={handleClick}
        />
        {isSelected && (
          <>
            <Edges scale={1.01} threshold={15} color="#00f3ff" />
            <MeasurementLabels obj={obj} />
          </>
        )}
      </group>
    );
  }

  const geometry = renderGeometry();

  return (
    <group position={obj.position} rotation={obj.rotation} scale={obj.scale}>
      <mesh 
        ref={activePhysicsRef} 
        onClick={handleClick}
      >
        {geometry}
        {material}
        {isSelected && <Edges scale={1.01} threshold={15} color="#00f3ff" />}
      </mesh>
      {isSelected && <MeasurementLabels obj={obj} />}
    </group>
  );
};

// --- Main App ---
export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPhysicsActive, setIsPhysicsActive] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPCBMode, setIsPCBMode] = useState(false);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [isProportionalEditing, setIsProportionalEditing] = useState(false);
  const [faceOrientation, setFaceOrientation] = useState(false);
  const [brushColor, setBrushColor] = useState('#00f3ff');
  const [brushSize, setBrushSize] = useState(2);
  const [drawOnSurface, setDrawOnSurface] = useState(false);
  const [shadingMode, setShadingMode] = useState<'wireframe' | 'solid' | 'material'>('material');
  const [currentTheme, setCurrentTheme] = useState(THEMES[0]);
  const [currentStroke, setCurrentStroke] = useState<[number, number, number][]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('default-room');
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number, y: number, name: string }>>({});
  const [isDraggingTransform, setIsDraggingTransform] = useState(false);
  
  // Responsive State
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--cyber-bg', currentTheme.bg);
    root.style.setProperty('--cyber-card', currentTheme.card);
    root.style.setProperty('--cyber-cyan', currentTheme.cyan);
    root.style.setProperty('--cyber-magenta', currentTheme.magenta);
    root.style.setProperty('--cyber-lime', currentTheme.lime);
    root.style.setProperty('--cyber-border', currentTheme.border);
  }, [currentTheme]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Undo/Redo State
  const [objects, setObjectsState] = useState<SceneObject[]>([
    {
      id: 'initial-box',
      name: 'Base Block',
      type: 'box',
      params: { width: 1, height: 1, depth: 1 },
      color: '#00f3ff',
      metalness: 0.6,
      roughness: 0.2,
      visible: true,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  ]);
  const [history, setHistory] = useState<SceneObject[][]>([[...objects]]);
  const [historyPointer, setHistoryPointer] = useState(0);

  const onMount = useCallback((id: string, mesh: any) => {
    setObjectsState(prev => {
      const obj = prev.find(o => o.id === id);
      if (obj && obj.mesh !== mesh) {
        return prev.map(o => o.id === id ? { ...o, mesh } : o);
      }
      return prev;
    });
  }, []);

  const setObjects = useCallback((newObjects: SceneObject[] | ((prev: SceneObject[]) => SceneObject[])) => {
    setObjectsState(prev => {
      const next = typeof newObjects === 'function' ? newObjects(prev) : newObjects;
      
      // Strip non-serializable fields for comparison
      const strip = (objs: SceneObject[]) => objs.map(({ mesh, ...rest }) => rest);
      
      // Only add to history if it's actually different
      if (JSON.stringify(strip(next)) !== JSON.stringify(strip(prev))) {
        const newHistory = history.slice(0, historyPointer + 1);
        newHistory.push(next);
        // Limit history size
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryPointer(newHistory.length - 1);
      }
      return next;
    });
  }, [history, historyPointer]);

  const undo = () => {
    if (historyPointer > 0) {
      const prevPointer = historyPointer - 1;
      setHistoryPointer(prevPointer);
      setObjectsState(history[prevPointer]);
      addLog("Undo performed.");
    }
  };

  const redo = () => {
    if (historyPointer < history.length - 1) {
      const nextPointer = historyPointer + 1;
      setHistoryPointer(nextPointer);
      setObjectsState(history[nextPointer]);
      addLog("Redo performed.");
    }
  };

  // Collaboration Setup
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      addLog("Collaboration: Connected to server.");
    });

    newSocket.on('room-state', (remoteObjects: SceneObject[]) => {
      setObjectsState(remoteObjects);
      addLog("Collaboration: Synced room state.");
    });

    newSocket.on('objects-updated', (remoteObjects: SceneObject[]) => {
      setObjectsState(remoteObjects);
    });

    newSocket.on('annotations-updated', (remoteAnnotations: Annotation[]) => {
      setAnnotations(remoteAnnotations);
    });

    newSocket.on('cursor-moved', ({ id, x, y, name }) => {
      setRemoteCursors(prev => ({ ...prev, [id]: { x, y, name } }));
    });

    newSocket.on('user-left', (id) => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = (id: string) => {
    if (socket) {
      socket.emit('join-room', id);
      setRoomId(id);
      setIsCollaborating(true);
      addLog(`Collaboration: Joined room ${id}`);
    }
  };

  useEffect(() => {
    if (socket && isCollaborating) {
      socket.emit('update-objects', { roomId, objects });
      socket.emit('update-annotations', { roomId, annotations });
    }
  }, [objects, annotations, isCollaborating, roomId, socket]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (socket && isCollaborating) {
      socket.emit('move-cursor', {
        roomId,
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
        name: "User_" + socket.id?.substr(0, 4)
      });
    }
  };

  const [selectedId, setSelectedId] = useState<string | null>('initial-box');
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>(['System initialized...', 'CAD Engine ready.', 'Blender Kernel v4.2 Loaded.']);
  const [aiResponse, setAiResponse] = useState('');
  const [cmdInput, setCmdInput] = useState('');
  
  // Ruler & Scene Settings
  const [isRulerMode, setIsRulerMode] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<THREE.Vector3[]>([]);
  const [rulerDistance, setRulerDistance] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [xray, setXray] = useState(false);
  const [bgColor, setBgColor] = useState('#050505');
  const [cameraView, setCameraView] = useState<'perspective' | 'top' | 'front' | 'side'>('perspective');

  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useEffect(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    switch (cameraView) {
      case 'top':
        cam.position.set(0, 10, 0);
        cam.lookAt(0, 0, 0);
        break;
      case 'front':
        cam.position.set(0, 0, 10);
        cam.lookAt(0, 0, 0);
        break;
      case 'side':
        cam.position.set(10, 0, 0);
        cam.lookAt(0, 0, 0);
        break;
      case 'perspective':
        cam.position.set(5, 5, 5);
        cam.lookAt(0, 0, 0);
        break;
    }
  }, [cameraView]);

  const selectedObj = objects.find(o => o.id === selectedId);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-14), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const addObject = (type: SceneObject['type'], params: any = {}, color = '#00f3ff') => {
    // Default dimensions for primitive shapes
    let dimensions = { width: 1, height: 1, depth: 1 };
    if (type === 'sphere') dimensions = { width: 1.4, height: 1.4, depth: 1.4 };
    if (type === 'cylinder') dimensions = { width: 1, height: 1.5, depth: 1 };
    if (type === 'torus') dimensions = { width: 1.8, height: 1.8, depth: 0.4 };
    if (type === 'pcb') dimensions = { width: 4, height: 0.1, depth: 6 };

    const newObj: SceneObject = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${type.toUpperCase()}_${objects.length + 1}`,
      type,
      params: { ...params, dimensions },
      color: type === 'pcb' ? '#1a4d1a' : color,
      metalness: 0.5,
      roughness: 0.5,
      visible: true,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      points: type === 'stroke' ? [] : undefined,
      pcbData: type === 'pcb' ? {
        layers: [
          { id: 'top-copper', name: 'Top Copper', color: '#ffcc00', visible: true, type: 'copper' },
          { id: 'top-silk', name: 'Top Silkscreen', color: '#ffffff', visible: true, type: 'silk' },
          { id: 'top-mask', name: 'Top Solder Mask', color: '#1a4d1a', visible: true, type: 'mask' },
        ],
        components: [
          { id: 'u1', name: 'MCU', position: [0, 0], type: 'ic' },
          { id: 'r1', name: 'R1', position: [1, 1], type: 'resistor' },
        ]
      } : undefined
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newObj.id);
    addLog(`Added ${type} to scene.`);
  };

  const updateObject = (id: string, updates: Partial<SceneObject>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteObject = (id: string) => {
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
    addLog(`Deleted object ${id}.`);
  };

  const duplicateObject = (id: string) => {
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    const newObj: SceneObject = {
      ...obj,
      id: Math.random().toString(36).substr(2, 9),
      name: `${obj.name}_COPY`,
      position: [obj.position[0] + 0.5, obj.position[1], obj.position[2] + 0.5],
      mesh: undefined // Don't copy mesh ref
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newObj.id);
    addLog(`Duplicated object ${obj.name}.`);
  };

  const resetScene = () => {
    setObjects([]);
    setSelectedId(null);
    setHistory([[]]);
    setHistoryPointer(0);
    addLog("Scene reset.");
  };

  const zoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.8);
      addLog("Viewport: Zoom in.");
    }
  };

  const zoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.2);
      addLog("Viewport: Zoom out.");
    }
  };

  const zoomToFit = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(5, 5, 5);
      cameraRef.current.lookAt(0, 0, 0);
      addLog("Viewport: View reset to default.");
    }
  };

  const renderHighRes = () => {
    addLog("Render: Generating high-quality image...");
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `render-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      addLog("Render: Image saved to downloads.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();
    addLog(`Loading file: ${file.name} (${extension})...`);

    reader.onload = async (event) => {
      const contents = event.target?.result;
      if (!contents) return;

      try {
        let mesh: THREE.Group | THREE.Mesh | null = null;
        if (extension === 'stl') {
          const loader = new STLLoader();
          const geometry = loader.parse(contents as ArrayBuffer);
          mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff' }));
        } else if (extension === 'obj') {
          const loader = new OBJLoader();
          mesh = loader.parse(contents as string);
        } else if (extension === 'glb' || extension === 'gltf') {
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(contents as ArrayBuffer, '');
          mesh = gltf.scene;
        }

        if (mesh) {
          // Center geometry
          if (mesh instanceof THREE.Mesh) {
            mesh.geometry.center();
          } else if (mesh instanceof THREE.Group) {
            const box = new THREE.Box3().setFromObject(mesh);
            const center = new THREE.Vector3();
            box.getCenter(center);
            mesh.position.sub(center);
          }

          // Calculate dimensions
          const box = new THREE.Box3().setFromObject(mesh);
          const size = new THREE.Vector3();
          box.getSize(size);

          // Calculate stats
          let vertices = 0;
          let faces = 0;
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const geometry = child.geometry;
              if (geometry.index) {
                faces += geometry.index.count / 3;
              } else if (geometry.attributes.position) {
                faces += geometry.attributes.position.count / 3;
              }
              if (geometry.attributes.position) {
                vertices += geometry.attributes.position.count;
              }
            }
          });

          const newObj: SceneObject = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: 'mesh',
            params: {
              dimensions: {
                width: size.x,
                height: size.y,
                depth: size.z
              }
            },
            stats: {
              vertices,
              faces
            },
            color: '#ffffff',
            metalness: 0.5,
            roughness: 0.5,
            visible: true,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            mesh
          };
          setObjects(prev => [...prev, newObj]);
          setSelectedId(newObj.id);
          addLog(`Successfully imported ${file.name}. Dimensions: ${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`);
          
          // Auto-focus on the new object
          setTimeout(() => {
            const pos = new THREE.Vector3(0, 0, 0);
            const offset = new THREE.Vector3(size.x * 2, size.y * 2, size.z * 2).addScalar(2);
            if (cameraRef.current) {
              cameraRef.current.position.copy(pos).add(offset);
              cameraRef.current.lookAt(pos);
            }
          }, 100);
        }
      } catch (err) {
        addLog(`Error loading file: ${err}`);
      }
    };

    if (extension === 'obj') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  };

  const handleGenerativeDesign = async () => {
    if (!selectedId) {
      addLog("Generative Design: Select an object to optimize.");
      return;
    }
    const obj = objects.find(o => o.id === selectedId);
    if (!obj) return;

    setIsGenerating(true);
    addLog("Generative Design: Starting topology optimization...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const promptText = `You are a generative design engineer. 
      Optimize the following 3D object for structural integrity and material efficiency:
      Object Name: ${obj.name}
      Current Type: ${obj.type}
      Color: ${obj.color}
      
      Return a JSON array of new objects that represent an optimized version (e.g., using lattice structures, hollowed parts, or reinforced sections).
      Each object should have: name, type (box, sphere, cylinder, torus), color, scale, position, rotation.
      Only return the JSON array.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });

      const optimizedObjects = JSON.parse(response.text);
      if (Array.isArray(optimizedObjects)) {
        const newObjects = optimizedObjects.map((o: any) => ({
          ...o,
          id: Math.random().toString(36).substr(2, 9),
          visible: true,
          metalness: 0.8,
          roughness: 0.2,
          position: o.position || [0, 0, 0],
          rotation: o.rotation || [0, 0, 0],
          scale: o.scale || [1, 1, 1]
        }));
        setObjects(prev => [...prev.filter(o => o.id !== selectedId), ...newObjects]);
        addLog("Generative Design: Optimization complete.");
      }
    } catch (err) {
      addLog(`Generative Design Error: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    addLog(`AI Module: Interpreting request "${prompt}"...`);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a CAD/Blender expert. Based on: "${prompt}", generate a JSON object for a 3D primitive or a scene modification. 
        If the user asks to "optimize" or "generative design", suggest a lattice-like structure or a more efficient shape.
        Supported types: "box", "sphere", "cylinder", "torus".
        Parameters: 
        - for box: width, height, depth
        - for sphere: radius
        - for cylinder: radius, height
        - for torus: radius, tube
        Also provide a hex color, metalness (0-1), roughness (0-1), position [x,y,z], and a brief explanation.
        Return ONLY valid JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              params: { type: Type.OBJECT },
              color: { type: Type.STRING },
              metalness: { type: Type.NUMBER },
              roughness: { type: Type.NUMBER },
              position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              explanation: { type: Type.STRING }
            },
            required: ["type", "params", "color", "metalness", "roughness", "position", "explanation"]
          }
        }
      });

      const data = JSON.parse(response.text);
      const newObj: SceneObject = {
        id: Math.random().toString(36).substr(2, 9),
        name: `AI_${data.type.toUpperCase()}`,
        type: data.type as any,
        params: data.params,
        color: data.color,
        metalness: data.metalness,
        roughness: data.roughness,
        visible: true,
        position: data.position || [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      };
      setObjects(prev => [...prev, newObj]);
      setSelectedId(newObj.id);
      setAiResponse(data.explanation);
      addLog(`AI Module: ${data.explanation}`);
    } catch (error) {
      addLog("AI Module: Error generating geometry.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTexture = async () => {
    if (!selectedObj) return;
    setIsGenerating(true);
    addLog(`AI Texture: Generating texture for ${selectedObj.name}...`);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: `Generate a high-quality, seamless PBR texture for a 3D model. 
        Theme: ${prompt || "futuristic metal"}
        Style: Realistic, detailed.`,
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64 = part.inlineData.data;
          const url = `data:image/png;base64,${base64}`;
          updateObject(selectedObj.id, { textureUrl: url });
          addLog("AI Texture: Texture applied successfully.");
          break;
        }
      }
    } catch (error) {
      addLog("AI Texture: Error generating texture.");
    } finally {
      setIsGenerating(false);
    }
  };

  const performBoolean = (type: 'union' | 'subtract' | 'intersect') => {
    if (!selectedId || objects.length < 2) {
      addLog("Boolean: Select an object and ensure at least 2 objects exist.");
      return;
    }
    
    const objA = objects.find(o => o.id === selectedId);
    const objB = objects.find(o => o.id !== selectedId && o.visible);
    
    if (!objA || !objB) return;

    addLog(`Boolean: Calculating ${type.toUpperCase()} between ${objA.name} and ${objB.name}...`);
    
    try {
      const evaluator = new Evaluator();
      
      // Helper to get geometry from mesh or group
      const getGeometry = (mesh: any) => {
        if (mesh instanceof THREE.Mesh) {
          const geo = mesh.geometry.clone();
          if (!geo.attributes.uv) {
            const count = geo.attributes.position.count;
            geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
          }
          return geo;
        }
        let geo: THREE.BufferGeometry | null = null;
        mesh.traverse((child: any) => {
          if (child instanceof THREE.Mesh && !geo) {
            geo = child.geometry.clone();
            if (!geo.attributes.uv) {
              const count = geo.attributes.position.count;
              geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
            }
          }
        });
        return geo;
      };

      const geoA = getGeometry(objA.mesh);
      const geoB = getGeometry(objB.mesh);

      if (!geoA || !geoB) {
        addLog("Boolean Error: Could not extract geometry.");
        return;
      }

      const brushA = new Brush(geoA, new THREE.MeshStandardMaterial({ color: objA.color }));
      brushA.position.set(...objA.position);
      brushA.rotation.set(...objA.rotation);
      brushA.scale.set(...objA.scale);
      brushA.updateMatrixWorld();

      const brushB = new Brush(geoB, new THREE.MeshStandardMaterial({ color: objB.color }));
      brushB.position.set(...objB.position);
      brushB.rotation.set(...objB.rotation);
      brushB.scale.set(...objB.scale);
      brushB.updateMatrixWorld();

      let op = ADDITION;
      if (type === 'subtract') op = SUBTRACTION;
      if (type === 'intersect') op = INTERSECTION;

      const result = evaluator.evaluate(brushA, brushB, op);
      
      const newObj: SceneObject = {
        id: Math.random().toString(36).substr(2, 9),
        name: `CSG_${type.toUpperCase()}`,
        type: 'mesh',
        params: {},
        color: objA.color,
        metalness: objA.metalness,
        roughness: objA.roughness,
        visible: true,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        mesh: result
      };

      setObjects(prev => [...prev.filter(o => o.id !== objA.id && o.id !== objB.id), newObj]);
      setSelectedId(newObj.id);
      addLog(`Boolean: ${type} successful.`);
    } catch (err) {
      addLog(`Boolean Error: ${err}`);
      console.error(err);
    }
  };

  const exportScene = (format: 'glb' | 'stl') => {
    addLog(`Export: Preparing ${format.toUpperCase()} file...`);
    const scene = new THREE.Scene();
    objects.forEach(obj => {
      if (obj.mesh) scene.add(obj.mesh.clone());
    });

    if (format === 'glb') {
      const exporter = new GLTFExporter();
      exporter.parse(scene, (result) => {
        const blob = new Blob([JSON.stringify(result)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'scene.glb';
        link.click();
      }, (err) => addLog(`Export Error: ${err}`), { binary: true });
    } else {
      const exporter = new STLExporter();
      const result = exporter.parse(scene);
      const blob = new Blob([result], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'scene.stl';
      link.click();
    }
  };

  const addAnnotation = () => {
    if (!selectedObj) return;
    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      objectId: selectedObj.id,
      text: "New Annotation",
      position: [selectedObj.position[0], selectedObj.position[1] + 1, selectedObj.position[2]]
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    addLog("Annotation: Added to object.");
  };

  const handleProcessCAD = async () => {
    if (!selectedObj) return;
    setIsProcessing(true);
    addLog(`AI Auditor: Deep scanning ${selectedObj.name}...`);
    
    try {
      // 1. Capture Screenshot for Visual Analysis
      const canvas = document.querySelector('canvas');
      let screenshotBase64 = "";
      if (canvas) {
        screenshotBase64 = canvas.toDataURL('image/png').split(',')[1];
      }

      // 2. Extract Mesh Stats if available
      let meshStats = { vertices: 0, faces: 0 };
      if (selectedObj.mesh) {
        selectedObj.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshStats.vertices += child.geometry.attributes.position.count;
            if (child.geometry.index) {
              meshStats.faces += child.geometry.index.count / 3;
            } else {
              meshStats.faces += child.geometry.attributes.position.count / 3;
            }
          }
        });
      }

      // 3. Basic Geometric Analysis (Simulated or from backend)
      const res = await fetch('/api/process-cad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometryData: selectedObj })
      });
      const baseData = await res.json();

      // 4. AI-Powered Thorough Audit with Visual Context
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const contents: any[] = [
        {
          text: `You are a professional CAD, AutoCAD, and Blender expert. 
          Analyze this 3D model thoroughly. 
          
          Metadata:
          Name: ${selectedObj.name}
          Type: ${selectedObj.type}
          Color: ${selectedObj.color}
          Metalness: ${selectedObj.metalness}
          Roughness: ${selectedObj.roughness}
          Scale: ${selectedObj.scale.join(', ')}
          Dimensions: ${selectedObj.params.dimensions ? `${(selectedObj.params.dimensions.width * selectedObj.scale[0]).toFixed(3)}x${(selectedObj.params.dimensions.height * selectedObj.scale[1]).toFixed(3)}x${(selectedObj.params.dimensions.depth * selectedObj.scale[2]).toFixed(3)}` : 'N/A'}
          Vertices: ${meshStats.vertices}
          Faces: ${meshStats.faces}
          
          Provide a thorough audit including:
          1. A concise summary of the model's purpose and design intent.
          2. Detailed Advantages (structural, aesthetic, manufacturing, topology).
          3. Detailed Disadvantages (potential failure points, non-manifold edges, poor topology, aesthetic flaws).
          4. Recommended Modifications (specific steps to improve efficiency, strength, or style, referencing AutoCAD/Blender techniques).
          
          Return the result in JSON format.`
        }
      ];

      if (screenshotBase64) {
        contents.push({
          inlineData: {
            mimeType: "image/png",
            data: screenshotBase64
          }
        });
      }

      const auditResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: contents },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              advantages: { type: Type.ARRAY, items: { type: Type.STRING } },
              disadvantages: { type: Type.ARRAY, items: { type: Type.STRING } },
              modifications: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "advantages", "disadvantages", "modifications"]
          }
        }
      });

      const aiAudit = JSON.parse(auditResponse.text);

      setAnalysis({
        ...baseData.analysis,
        summary: aiAudit.summary,
        advantages: aiAudit.advantages,
        disadvantages: aiAudit.disadvantages,
        modifications: aiAudit.modifications,
        blenderStats: meshStats
      });
      
      addLog("AI Auditor: Thorough check complete. Visual analysis integrated.");
    } catch (error) {
      addLog("AI Auditor: Deep scan failed.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReport = () => {
    addLog("Report Gen: Compiling data...");
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("AI CAD FLOW - Scene Report", 20, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, 30);
    
    let y = 45;
    objects.forEach((obj, i) => {
      doc.text(`${i+1}. ${obj.name} (${obj.type})`, 20, y);
      doc.text(`   Pos: ${obj.position.join(', ')}`, 20, y + 5);
      doc.text(`   Color: ${obj.color}`, 20, y + 10);
      y += 20;
    });

    if (analysis) {
      doc.addPage();
      doc.text("AI Audit Results", 20, 20);
      doc.setFontSize(12);
      
      doc.text("Summary:", 20, 35);
      doc.setFontSize(10);
      const splitSummary = doc.splitTextToSize(analysis.summary, 170);
      doc.text(splitSummary, 25, 42);
      
      let yOffset = 42 + (splitSummary.length * 5) + 10;
      
      doc.setFontSize(12);
      doc.text("Advantages:", 20, yOffset);
      doc.setFontSize(10);
      analysis.advantages.forEach((adv, i) => {
        const split = doc.splitTextToSize(`- ${adv}`, 170);
        doc.text(split, 25, yOffset + 10 + (i * 7));
      });
      
      yOffset += 10 + (analysis.advantages.length * 7) + 10;
      doc.setFontSize(12);
      doc.text("Disadvantages:", 20, yOffset);
      doc.setFontSize(10);
      analysis.disadvantages.forEach((dis, i) => {
        const split = doc.splitTextToSize(`- ${dis}`, 170);
        doc.text(split, 25, yOffset + 10 + (i * 7));
      });
      
      yOffset += 10 + (analysis.disadvantages.length * 7) + 10;
      doc.setFontSize(12);
      doc.text("Recommended Modifications:", 20, yOffset);
      doc.setFontSize(10);
      analysis.modifications.forEach((mod, i) => {
        const split = doc.splitTextToSize(`- ${mod}`, 170);
        doc.text(split, 25, yOffset + 10 + (i * 7));
      });
    }

    doc.save("scene-report.pdf");
    addLog("Report Gen: PDF exported.");
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cmdInput.toLowerCase().trim();
    if (!cmd) return;

    addLog(`User: ${cmd}`);
    if (cmd === 'clear') setLogs([]);
    else if (cmd === 'add box') addObject('box');
    else if (cmd === 'add sphere') addObject('sphere');
    else if (cmd === 'add cylinder') addObject('cylinder');
    else if (cmd === 'add torus') addObject('torus');
    else if (cmd === 'duplicate') selectedId && duplicateObject(selectedId);
    else if (cmd === 'delete') selectedId && deleteObject(selectedId);
    else if (cmd.startsWith('color ')) {
      const color = cmd.split(' ')[1];
      selectedId && updateObject(selectedId, { color });
    } else {
      addLog(`Unknown command: ${cmd}`);
    }
    setCmdInput('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.toLowerCase() === 'f' && selectedId) {
        const obj = objects.find(o => o.id === selectedId);
        if (obj && cameraRef.current) {
          const pos = new THREE.Vector3(...obj.position);
          cameraRef.current.position.set(pos.x + 5, pos.y + 5, pos.z + 5);
          cameraRef.current.lookAt(pos);
          addLog(`Focused on ${obj.name}`);
        }
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) deleteObject(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, objects, undo, redo, deleteObject]);

  return (
    <div 
      onMouseMove={handleMouseMove}
      className="min-h-screen bg-cyber-bg text-white font-sans selection:bg-cyber-cyan/30 relative overflow-hidden"
    >
      <div className="scanline" />
      
      {/* Remote Cursors */}
      {Object.entries(remoteCursors).map(([id, cursor]) => (
        <div 
          key={id}
          className="absolute pointer-events-none z-[100] flex flex-col items-center transition-all duration-75"
          style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
        >
          <MousePointer2 className="w-4 h-4 text-cyber-magenta fill-cyber-magenta" />
          <span className="text-[8px] font-bold bg-cyber-magenta px-1 rounded text-white">{cursor.name}</span>
        </div>
      ))}
      
      {/* Header */}
      <header className="h-14 border-b border-cyber-cyan/20 flex items-center justify-between px-4 lg:px-6 bg-cyber-bg/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2 lg:gap-3">
          {isMobile && (
            <button 
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="p-2 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded text-cyber-cyan"
            >
              {leftSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          <div className="w-8 h-8 bg-cyber-cyan/10 border border-cyber-cyan/40 rounded flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.2)]">
            <Layers className="w-5 h-5 text-cyber-cyan cyber-glow-cyan" />
          </div>
          <h1 className="text-sm lg:text-lg font-black tracking-[0.15em] cyber-glow-cyan text-cyber-cyan">
            AI CAD FLOW 
            {!isMobile && <span className="text-[9px] font-mono text-white/30 tracking-normal ml-2">v4.2-PRO</span>}
          </h1>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-4">
          {!isMobile && (
            <div className="flex items-center gap-2 px-2 py-1 bg-black/40 border border-white/10 rounded-lg">
              <span className="text-[8px] font-mono text-white/40 uppercase">Room:</span>
              <input 
                type="text" 
                value={roomId} 
                onChange={(e) => setRoomId(e.target.value)}
                className="bg-transparent border-none text-[10px] font-mono text-cyber-cyan focus:outline-none w-20"
              />
              <button onClick={() => joinRoom(roomId)} className={cn("p-1 rounded transition-all", isCollaborating ? "text-cyber-cyan" : "text-white/40 hover:text-white")} title="Join Room"><Share2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
          
          <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-lg">
            {!isMobile && (
              <>
                <button onClick={() => setIsCollaborating(!isCollaborating)} className={cn("p-1.5 rounded transition-all", isCollaborating ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white")} title="Collaborate"><Share2 className="w-4 h-4" /></button>
                <div className="w-[1px] bg-white/10 mx-1" />
                <button onClick={undo} disabled={historyPointer === 0} className="p-1.5 rounded text-white/40 hover:text-cyber-cyan disabled:opacity-20"><Undo2 className="w-4 h-4" /></button>
                <button onClick={redo} disabled={historyPointer === history.length - 1} className="p-1.5 rounded text-white/40 hover:text-cyber-cyan disabled:opacity-20"><Redo2 className="w-4 h-4" /></button>
                <div className="w-[1px] bg-white/10 mx-1" />
                <button onClick={renderHighRes} className="p-1.5 rounded text-white/40 hover:text-cyber-cyan" title="Render Image"><Video className="w-4 h-4" /></button>
                <div className="w-[1px] bg-white/10 mx-1" />
              </>
            )}
            <button onClick={() => setTransformMode('translate')} className={cn("p-1.5 rounded transition-all", transformMode === 'translate' ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white")}><Move className="w-4 h-4" /></button>
            <button onClick={() => setTransformMode('rotate')} className={cn("p-1.5 rounded transition-all", transformMode === 'rotate' ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white")}><RotateCw className="w-4 h-4" /></button>
            <button onClick={() => setTransformMode('scale')} className={cn("p-1.5 rounded transition-all", transformMode === 'scale' ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white")}><Scale className="w-4 h-4" /></button>
            <div className="w-[1px] bg-white/10 mx-1" />
            <button 
              onClick={() => setIsProportionalEditing(!isProportionalEditing)} 
              className={cn("p-1.5 rounded transition-all", isProportionalEditing ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white")}
              title="Proportional Editing (O)"
            >
              <CircleDot className="w-4 h-4" />
            </button>
            <div className="w-[1px] bg-white/10 mx-1" />
            <div className="flex gap-1 p-0.5 bg-black/20 rounded">
              <button onClick={() => setShadingMode('wireframe')} className={cn("p-1 rounded text-[8px] uppercase font-bold", shadingMode === 'wireframe' ? "bg-white/10 text-cyber-cyan" : "text-white/20")}>Wire</button>
              <button onClick={() => setShadingMode('solid')} className={cn("p-1 rounded text-[8px] uppercase font-bold", shadingMode === 'solid' ? "bg-white/10 text-cyber-cyan" : "text-white/20")}>Solid</button>
              <button onClick={() => setShadingMode('material')} className={cn("p-1 rounded text-[8px] uppercase font-bold", shadingMode === 'material' ? "bg-white/10 text-cyber-cyan" : "text-white/20")}>Mat</button>
              <div className="w-[1px] bg-white/5 mx-0.5" />
              <button onClick={() => setXray(!xray)} className={cn("p-1 rounded transition-all", xray ? "text-cyber-cyan" : "text-white/20")} title="X-Ray (Alt+Z)">
                <Eye className="w-3 h-3" />
              </button>
              <button onClick={() => setFaceOrientation(!faceOrientation)} className={cn("p-1 rounded transition-all", faceOrientation ? "text-cyber-cyan" : "text-white/20")} title="Face Orientation">
                <Target className="w-3 h-3" />
              </button>
            </div>
            {!isMobile && (
              <>
                <div className="w-[1px] bg-white/10 mx-1" />
                <button 
                  onClick={() => setIsDrawingMode(!isDrawingMode)} 
                  className={cn("p-1.5 rounded transition-all", isDrawingMode ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white")}
                  title="Freehand Draw (Grease Pencil)"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setIsPCBMode(!isPCBMode); if (!isPCBMode) addObject('pcb'); }} 
                  className={cn("p-1.5 rounded transition-all", isPCBMode ? "bg-cyber-lime text-black" : "text-white/40 hover:text-white")}
                  title="PCB Viewer Mode"
                >
                  <CircuitBoard className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSnapToGrid(!snapToGrid)} 
                  className={cn("p-1.5 rounded transition-all", snapToGrid ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white")}
                  title="Snap to Grid"
                >
                  <GridIcon className="w-4 h-4" />
                </button>
                <div className="w-[1px] bg-white/10 mx-1" />
                <button onClick={() => setIsPhysicsActive(!isPhysicsActive)} className={cn("p-1.5 rounded transition-all", isPhysicsActive ? "bg-cyber-lime text-black" : "text-white/40 hover:text-white")} title="Physics"><Zap className="w-4 h-4" /></button>
                <button 
                  onClick={() => {
                    setIsRulerMode(!isRulerMode);
                    setRulerPoints([]);
                    setRulerDistance(null);
                  }} 
                  className={cn("p-1.5 rounded transition-all", isRulerMode ? "bg-cyber-magenta text-white" : "text-white/40 hover:text-white")}
                >
                  <Ruler className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {!isMobile && (
            <label className="flex items-center gap-2 px-3 py-1.5 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-lg cursor-pointer hover:bg-cyber-cyan/20 transition-all">
              <Upload className="w-4 h-4 text-cyber-cyan" />
              <span className="text-[10px] font-bold text-cyber-cyan uppercase tracking-wider">Import Model</span>
              <input type="file" className="hidden" accept=".stl,.obj,.glb,.gltf" onChange={handleFileUpload} />
            </label>
          )}

          {isMobile && (
            <button 
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="p-2 bg-cyber-magenta/10 border border-cyber-magenta/30 rounded text-cyber-magenta"
            >
              <Activity className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="p-2 lg:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-3.5rem)] overflow-hidden relative">
        <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />

        {/* Backdrop for mobile sidebars */}
        {isMobile && (leftSidebarOpen || rightSidebarOpen) && (
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => { setLeftSidebarOpen(false); setRightSidebarOpen(false); }}
          />
        )}

        {/* Left Panel: Outliner & Material */}
        <div className={cn(
          "flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar z-50 transition-all duration-300",
          isMobile 
            ? "absolute left-0 top-0 bottom-0 w-[85vw] max-w-xs bg-cyber-bg/95 border-r border-cyber-cyan/20 p-4" 
            : "col-span-3",
          isMobile && !leftSidebarOpen && "-translate-x-full"
        )}>
          {/* Scene Outliner */}
          <section className="cyber-card p-4 flex flex-col gap-3 max-h-[40%]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-cyber-cyan">
                <Layers className="w-3.5 h-3.5" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Scene Outliner</h2>
              </div>
              <div className="flex gap-1">
                <button onClick={() => addObject('box')} title="Add Box" className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-cyber-cyan"><Box className="w-3.5 h-3.5" /></button>
                <button onClick={() => addObject('sphere')} title="Add Sphere" className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-cyber-cyan"><RefreshCw className="w-3.5 h-3.5" /></button>
                <button onClick={() => addObject('cylinder')} title="Add Cylinder" className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-cyber-cyan"><Maximize2 className="w-3.5 h-3.5" /></button>
                <button onClick={resetScene} title="Reset Scene" className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
              {objects.map(obj => (
                <div 
                  key={obj.id}
                  onClick={() => setSelectedId(obj.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded text-[10px] font-mono cursor-pointer transition-all border",
                    selectedId === obj.id ? "bg-cyber-cyan/10 border-cyber-cyan/40 text-cyber-cyan" : "bg-white/5 border-transparent text-white/40 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Box className="w-3 h-3" />
                    {obj.name}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const pos = new THREE.Vector3(...obj.position);
                        if (cameraRef.current) {
                          cameraRef.current.position.set(pos.x + 5, pos.y + 5, pos.z + 5);
                          cameraRef.current.lookAt(pos);
                        }
                      }}
                      title="Focus Camera"
                      className="p-1 hover:bg-white/10 rounded text-white/20 hover:text-cyber-cyan"
                    >
                      <Target className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); updateObject(obj.id, { visible: !obj.visible }); }}>
                      {obj.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteObject(obj.id); }} className="hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Material Editor */}
          <section className="cyber-card p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-cyber-magenta border-b border-white/10 pb-2">
              <Palette className="w-3.5 h-3.5" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Material Editor</h2>
            </div>
            {selectedObj ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] text-white/40 uppercase"><span>Color</span><span className="text-cyber-cyan">{selectedObj.color}</span></div>
                  <input type="color" value={selectedObj.color} onChange={(e) => updateObject(selectedObj.id, { color: e.target.value })} className="w-full h-8 bg-transparent border-none cursor-pointer" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] text-white/40 uppercase"><span>Metalness</span><span className="text-cyber-cyan">{selectedObj.metalness.toFixed(2)}</span></div>
                  <input type="range" min="0" max="1" step="0.01" value={selectedObj.metalness} onChange={(e) => updateObject(selectedObj.id, { metalness: parseFloat(e.target.value) })} className="w-full accent-cyber-cyan" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] text-white/40 uppercase"><span>Roughness</span><span className="text-cyber-cyan">{selectedObj.roughness.toFixed(2)}</span></div>
                  <input type="range" min="0" max="1" step="0.01" value={selectedObj.roughness} onChange={(e) => updateObject(selectedObj.id, { roughness: parseFloat(e.target.value) })} className="w-full accent-cyber-cyan" />
                </div>
                <div className="pt-2 border-t border-white/5 space-y-2">
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/40 uppercase">Visible</span>
                      <button onClick={() => updateObject(selectedObj.id, { visible: !selectedObj.visible })} className={cn("w-8 h-4 rounded-full relative transition-all", selectedObj.visible ? "bg-cyber-cyan" : "bg-white/10")}>
                        <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", selectedObj.visible ? "left-4.5" : "left-0.5")} />
                      </button>
                   </div>
                </div>

                {selectedObj.params.dimensions && (
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-cyber-lime">
                      <Maximize2 className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Physical Dimensions</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black/40 border border-white/5 p-2 rounded flex flex-col items-center">
                        <span className="text-[7px] text-white/30 uppercase">Width</span>
                        <span className="text-[10px] text-cyber-cyan font-mono tracking-tighter">{(selectedObj.params.dimensions.width * selectedObj.scale[0]).toFixed(3)}</span>
                      </div>
                      <div className="bg-black/40 border border-white/5 p-2 rounded flex flex-col items-center">
                        <span className="text-[7px] text-white/30 uppercase">Height</span>
                        <span className="text-[10px] text-cyber-magenta font-mono tracking-tighter">{(selectedObj.params.dimensions.height * selectedObj.scale[1]).toFixed(3)}</span>
                      </div>
                      <div className="bg-black/40 border border-white/5 p-2 rounded flex flex-col items-center">
                        <span className="text-[7px] text-white/30 uppercase">Depth</span>
                        <span className="text-[10px] text-cyber-lime font-mono tracking-tighter">{(selectedObj.params.dimensions.depth * selectedObj.scale[2]).toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center text-[10px] text-white/20 italic">Select an object to edit</div>
            )}
          </section>

          {/* Scene Settings */}
          <section className="cyber-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-white/60 border-b border-white/10 pb-2">
              <Settings className="w-3.5 h-3.5" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Scene Settings</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] text-white/40 uppercase"><Grid3X3 className="w-3 h-3" /> Show Grid</div>
                <button onClick={() => setShowGrid(!showGrid)} className={cn("w-8 h-4 rounded-full relative transition-all", showGrid ? "bg-cyber-cyan" : "bg-white/10")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", showGrid ? "left-4.5" : "left-0.5")} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] text-white/40 uppercase"><BoxSelect className="w-3 h-3" /> Grid Snapping</div>
                <button onClick={() => setSnapToGrid(!snapToGrid)} className={cn("w-8 h-4 rounded-full relative transition-all", snapToGrid ? "bg-cyber-cyan" : "bg-white/10")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", snapToGrid ? "left-4.5" : "left-0.5")} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] text-white/40 uppercase"><Eye className="w-3 h-3" /> X-Ray Mode</div>
                <button onClick={() => setXray(!xray)} className={cn("w-8 h-4 rounded-full relative transition-all", xray ? "bg-cyber-cyan" : "bg-white/10")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", xray ? "left-4.5" : "left-0.5")} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] text-white/40 uppercase"><Maximize2 className="w-3 h-3" /> Wireframe All</div>
                <button onClick={() => setWireframe(!wireframe)} className={cn("w-8 h-4 rounded-full relative transition-all", wireframe ? "bg-cyber-cyan" : "bg-white/10")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", wireframe ? "left-4.5" : "left-0.5")} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] text-white/40 uppercase"><Zap className="w-3 h-3" /> Global Physics</div>
                <button onClick={() => setIsPhysicsActive(!isPhysicsActive)} className={cn("w-8 h-4 rounded-full relative transition-all", isPhysicsActive ? "bg-cyber-lime" : "bg-white/10")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", isPhysicsActive ? "left-4.5" : "left-0.5")} />
                </button>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] text-white/30 uppercase">Background</div>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-4 bg-transparent border-none cursor-pointer" />
              </div>
            </div>
          </section>

          {/* AI Module */}
          <section className="cyber-card p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-cyber-cyan">
              <Cpu className="w-3.5 h-3.5" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">AI Design Engine</h2>
            </div>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="GENERATE COMPLEX GEOMETRY..."
              className="w-full h-20 bg-black/40 border border-cyber-cyan/20 rounded p-3 text-[10px] font-mono focus:outline-none focus:border-cyber-cyan/50 transition-all resize-none placeholder:text-white/10"
            />
            <div className="grid grid-cols-3 gap-1">
              <button onClick={handleGenerateAI} disabled={isGenerating || !prompt} className="py-2 bg-cyber-cyan text-black text-[9px] font-bold uppercase rounded hover:bg-white transition-all flex items-center justify-center gap-1">
                <Dna className="w-3 h-3" /> BUILD
              </button>
              <button onClick={handleGenerativeDesign} disabled={isGenerating || !selectedId} className="py-2 bg-cyber-magenta text-white text-[9px] font-bold uppercase rounded hover:bg-white hover:text-black transition-all flex items-center justify-center gap-1">
                <Zap className="w-3 h-3" /> OPTIMIZE
              </button>
              <button onClick={handleGenerateTexture} disabled={isGenerating || !selectedObj} className="py-2 bg-white/10 text-white text-[9px] font-bold uppercase rounded hover:bg-white hover:text-black transition-all flex items-center justify-center gap-1">
                <ImageIcon className="w-3 h-3" /> TEXTURE
              </button>
            </div>
          </section>

          {/* Advanced Tools */}
          <section className="cyber-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-white/60 border-b border-white/10 pb-2">
              <Zap className="w-3.5 h-3.5" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Advanced Tools</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => performBoolean('union')} className="p-2 bg-white/5 border border-white/10 rounded text-[8px] font-bold hover:bg-cyber-cyan hover:text-black transition-all">UNION</button>
              <button onClick={() => performBoolean('subtract')} className="p-2 bg-white/5 border border-white/10 rounded text-[8px] font-bold hover:bg-cyber-cyan hover:text-black transition-all">SUB</button>
              <button onClick={() => performBoolean('intersect')} className="p-2 bg-white/5 border border-white/10 rounded text-[8px] font-bold hover:bg-cyber-cyan hover:text-black transition-all">INT</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={addAnnotation} className="p-2 bg-white/5 border border-white/10 rounded text-[8px] font-bold hover:bg-cyber-magenta transition-all flex items-center justify-center gap-2"><Tag className="w-3 h-3" /> ANNOTATE</button>
              <button onClick={() => selectedId && updateObject(selectedId, { isPhysicsEnabled: !selectedObj?.isPhysicsEnabled })} className={cn("p-2 border rounded text-[8px] font-bold transition-all flex items-center justify-center gap-2", selectedObj?.isPhysicsEnabled ? "bg-cyber-lime text-black border-cyber-lime" : "bg-white/5 border-white/10")}>
                <Zap className="w-3 h-3" /> {selectedObj?.isPhysicsEnabled ? "PHYSICS ON" : "PHYSICS OFF"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <button onClick={() => exportScene('glb')} className="p-2 bg-white/5 border border-white/10 rounded text-[8px] font-bold hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"><Download className="w-3 h-3" /> GLB</button>
              <button onClick={() => exportScene('stl')} className="p-2 bg-white/5 border border-white/10 rounded text-[8px] font-bold hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"><Download className="w-3 h-3" /> STL</button>
            </div>
          </section>
        </div>

        {/* Center Panel: 3D Viewer */}
        <div className={cn(
          "relative cyber-card bg-black group z-10 overflow-hidden min-h-[40vh]",
          isMobile ? "col-span-1" : "col-span-6"
        )}>
          {/* Viewport Statistics Overlay */}
          {selectedObj && (
            <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-1">
              <div className="px-3 py-2 bg-black/40 border border-white/10 backdrop-blur-md rounded-lg flex flex-col gap-1">
                <div className="flex items-center gap-2 text-cyber-cyan mb-1">
                  <Activity className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Object Statistics</span>
                </div>
                <div className="flex justify-between gap-6 text-[8px] font-mono">
                  <span className="text-white/30 uppercase">Name</span>
                  <span className="text-white/80">{selectedObj.name}</span>
                </div>
                {selectedObj.stats && (
                  <>
                    <div className="flex justify-between gap-6 text-[8px] font-mono">
                      <span className="text-white/30 uppercase">Vertices</span>
                      <span className="text-cyber-cyan">{selectedObj.stats.vertices.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-6 text-[8px] font-mono">
                      <span className="text-white/30 uppercase">Faces</span>
                      <span className="text-cyber-cyan">{selectedObj.stats.faces.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Drawing Toolbar Overlay */}
          {isDrawingMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-2 bg-black/60 border border-cyber-cyan/30 backdrop-blur-md rounded-full shadow-[0_0_20px_rgba(0,243,255,0.2)]">
              <div className="flex items-center gap-1 px-2 border-r border-white/10">
                <Pencil className="w-3 h-3 text-cyber-cyan" />
                <span className="text-[8px] font-bold text-white/50 uppercase tracking-tighter">Draw Mode</span>
              </div>
              
              <div className="flex items-center gap-2 px-2 border-r border-white/10">
                <input 
                  type="color" 
                  value={brushColor} 
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="w-4 h-4 rounded-full bg-transparent border-none cursor-pointer"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] text-white/30 uppercase">Size</span>
                  <input 
                    type="range" min="1" max="10" step="0.5" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                    className="w-16 h-1 accent-cyber-cyan"
                  />
                </div>
              </div>

              <button 
                onClick={() => setDrawOnSurface(!drawOnSurface)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full transition-all text-[8px] font-bold uppercase",
                  drawOnSurface ? "bg-cyber-cyan text-black" : "text-white/40 hover:text-white"
                )}
              >
                <Target className="w-2.5 h-2.5" />
                Surface
              </button>

              <button 
                onClick={() => {
                  setObjects(objects.filter(o => o.type !== 'stroke'));
                  addLog("Grease Pencil: All strokes cleared.");
                }}
                className="p-1.5 text-white/20 hover:text-red-500 transition-colors"
                title="Clear All Strokes"
              >
                <Trash2 className="w-3 h-3" />
              </button>

              <button 
                onClick={() => setIsDrawingMode(false)}
                className="ml-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[8px] font-bold uppercase rounded-full transition-all"
              >
                Done
              </button>
            </div>
          )}

          {/* Viewport Controls Overlay */}
          <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2">
            <button 
              onClick={zoomIn}
              className="w-8 h-8 flex items-center justify-center bg-black/60 border border-cyber-cyan/30 rounded-lg text-cyber-cyan hover:bg-cyber-cyan/20 transition-all shadow-lg"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={zoomOut}
              className="w-8 h-8 flex items-center justify-center bg-black/60 border border-cyber-cyan/30 rounded-lg text-cyber-cyan hover:bg-cyber-cyan/20 transition-all shadow-lg"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button 
              onClick={zoomToFit}
              className="w-8 h-8 flex items-center justify-center bg-black/60 border border-cyber-cyan/30 rounded-lg text-cyber-cyan hover:bg-cyber-cyan/20 transition-all shadow-lg"
              title="Reset View"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          <Canvas 
            shadows 
            gl={{ preserveDrawingBuffer: true }}
            onPointerDown={(e) => {
              if (isRulerMode) {
                // If we didn't hit an object, we can use the ground plane
              }
            }}
          >
            <Suspense fallback={null}>
              <color attach="background" args={[bgColor]} />
              <PerspectiveCamera ref={cameraRef} makeDefault position={[5, 5, 5]} />
              <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
              </GizmoHelper>
              <OrbitControls 
                makeDefault 
                minDistance={1} 
                maxDistance={50} 
                enabled={!isDraggingTransform && !isRulerMode && !isDrawingMode} 
              />
              
              <Environment preset="city" />
              <ambientLight intensity={0.4} />
              <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
              <pointLight position={[-10, -10, -10]} intensity={0.5} />
              
              <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />

              <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
              </GizmoHelper>

              <Physics gravity={[0, isPhysicsActive ? -9.81 : 0, 0]}>
                {objects.map(obj => (
                  <Shape 
                    key={obj.id} 
                    obj={{
                      ...obj, 
                      params: {
                        ...obj.params, 
                        wireframe: wireframe || obj.params.wireframe
                      }
                    }} 
                    isSelected={selectedId === obj.id} 
                    isXray={xray}
                    shadingMode={shadingMode}
                    faceOrientation={faceOrientation}
                    onMount={onMount}
                    onSelect={(id) => {
                      if (isRulerMode) {
                        const clickedObj = objects.find(o => o.id === id);
                        if (clickedObj) {
                          const pos = new THREE.Vector3(...clickedObj.position);
                          setRulerPoints(prev => {
                            const next = [...prev, pos].slice(-2);
                            if (next.length === 2) {
                              setRulerDistance(next[0].distanceTo(next[1]));
                            }
                            return next;
                          });
                        }
                      } else {
                        setSelectedId(id);
                      }
                    }} 
                  />
                ))}
              </Physics>

              {annotations.map(ann => (
                <Html key={ann.id} position={ann.position}>
                  <div className="px-2 py-1 bg-cyber-magenta text-white text-[8px] font-bold rounded shadow-lg whitespace-nowrap">
                    {ann.text}
                  </div>
                </Html>
              ))}

              {/* Invisible Plane for Ruler */}
              {isRulerMode && (
                <mesh 
                  rotation={[-Math.PI / 2, 0, 0]} 
                  position={[0, -0.01, 0]} 
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const pos = e.point;
                    setRulerPoints(prev => {
                      const next = [...prev, pos].slice(-2);
                      if (next.length === 2) {
                        setRulerDistance(next[0].distanceTo(next[1]));
                      }
                      return next;
                    });
                  }}
                >
                  <planeGeometry args={[100, 100]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              )}

              {/* Drawing System */}
              <DrawingSystem 
                isDrawingMode={isDrawingMode}
                currentStroke={currentStroke}
                setCurrentStroke={setCurrentStroke}
                onFinishStroke={(points) => {
                  const newStroke: SceneObject = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'stroke',
                    name: `Stroke_${objects.length + 1}`,
                    position: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                    color: brushColor,
                    metalness: 0,
                    roughness: 1,
                    visible: true,
                    points: points,
                    params: { lineWidth: brushSize }
                  };
                  setObjects([...objects, newStroke]);
                  addLog("Grease Pencil: Stroke added.");
                }}
                brushColor={brushColor}
                brushSize={brushSize}
                drawOnSurface={drawOnSurface}
              />
              {currentStroke.length > 1 && (
                <Line points={currentStroke} color={brushColor} lineWidth={brushSize} />
              )}

              {selectedId && transformMode && objects.find(o => o.id === selectedId)?.mesh?.parent && (
                <TransformControls 
                  object={objects.find(o => o.id === selectedId)?.mesh || undefined} 
                  mode={transformMode} 
                  translationSnap={snapToGrid ? 0.5 : null}
                  rotationSnap={snapToGrid ? Math.PI / 12 : null}
                  scaleSnap={snapToGrid ? 0.1 : null}
                  onMouseDown={() => setIsDraggingTransform(true)}
                  onMouseUp={() => {
                    setIsDraggingTransform(false);
                    // Sync position back to state
                    const obj = objects.find(o => o.id === selectedId);
                    if (obj?.mesh) {
                      updateObject(selectedId, {
                        position: [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z],
                        rotation: [obj.mesh.rotation.x, obj.mesh.rotation.y, obj.mesh.rotation.z],
                        scale: [obj.mesh.scale.x, obj.mesh.scale.y, obj.mesh.scale.z]
                      });
                    }
                  }}
                />
              )}

              {showGrid && (
                <Grid 
                  infiniteGrid 
                  fadeDistance={20} 
                  sectionSize={1} 
                  sectionThickness={1.5} 
                  sectionColor="#00f3ff" 
                  cellColor="#00f3ff" 
                  cellSize={0.5}
                />
              )}
              
              {isRulerMode && rulerPoints.map((p, i) => (
                <mesh key={i} position={p}>
                  <sphereGeometry args={[0.05, 16, 16]} />
                  <meshBasicMaterial color="#ff00ff" />
                </mesh>
              ))}
              
              {isRulerMode && rulerPoints.length === 2 && (
                <line>
                  <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(rulerPoints)} />
                  <lineBasicMaterial attach="material" color="#ff00ff" linewidth={2} />
                </line>
              )}

              <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10} blur={2} far={4.5} />
            </Suspense>
          </Canvas>

          {/* HUD Overlay */}
          <div className="absolute top-4 left-4 pointer-events-none space-y-2">
            <div className="flex gap-2">
              <div className="px-2 py-1 bg-cyber-cyan/10 border border-cyber-cyan/30 text-[8px] font-mono text-cyber-cyan">FPS: 60</div>
              <div className="px-2 py-1 bg-black/60 border border-white/10 text-[8px] font-mono text-white/40 uppercase">Objects: {objects.length}</div>
              {isRulerMode && (
                <div className="px-2 py-1 bg-cyber-magenta/20 border border-cyber-magenta/40 text-[8px] font-mono text-cyber-magenta uppercase animate-pulse">
                  Ruler Active: {rulerDistance ? `${rulerDistance.toFixed(3)} units` : "Select 2 points"}
                </div>
              )}
            </div>
          </div>

          {/* Camera Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1">
            <button onClick={() => setCameraView('top')} className="w-8 h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center text-[8px] font-bold hover:bg-cyber-cyan hover:text-black transition-all">TOP</button>
            <button onClick={() => setCameraView('front')} className="w-8 h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center text-[8px] font-bold hover:bg-cyber-cyan hover:text-black transition-all">FRNT</button>
            <button onClick={() => setCameraView('side')} className="w-8 h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center text-[8px] font-bold hover:bg-cyber-cyan hover:text-black transition-all">SIDE</button>
            <button onClick={() => setCameraView('perspective')} className="w-8 h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center text-[8px] font-bold hover:bg-cyber-cyan hover:text-black transition-all">PERP</button>
          </div>

          {/* Cyber Scan Effect */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center overflow-hidden"
              >
                <div className="absolute inset-0 bg-cyber-magenta/5 animate-pulse" />
                <motion.div 
                  initial={{ top: '-100%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-1 bg-cyber-magenta shadow-[0_0_20px_#ff00ff] z-30"
                />
                <div className="relative flex flex-col items-center gap-4">
                  <div className="w-32 h-32 border-2 border-cyber-magenta/50 rounded-full animate-spin border-t-transparent shadow-[0_0_30px_rgba(255,0,255,0.2)]" />
                  <p className="text-cyber-magenta font-black tracking-[0.3em] text-[10px] animate-pulse">AI DEEP SCAN IN PROGRESS...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Panel: Terminal & Analysis */}
        <div className={cn(
          "flex flex-col gap-4 z-50 transition-all duration-300",
          isMobile 
            ? "absolute right-0 top-0 bottom-0 w-[85vw] max-w-xs bg-cyber-bg/95 border-l border-cyber-magenta/20 p-4" 
            : "col-span-3",
          isMobile && !rightSidebarOpen && "translate-x-full"
        )}>
          {/* NEW: Model Preview Section */}
          <section className="cyber-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyber-cyan border-b border-white/10 pb-2">
              <Eye className="w-3.5 h-3.5" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Visual Inspector</h2>
            </div>
            <ModelPreview obj={selectedObj} />
          </section>

          {/* Theme Selector */}
          <section className="cyber-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyber-cyan border-b border-white/10 pb-2">
              <Palette className="w-3.5 h-3.5" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">UI Themes</h2>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map(theme => (
                <button 
                  key={theme.id}
                  onClick={() => setCurrentTheme(theme)}
                  className={cn(
                    "w-full aspect-square rounded border transition-all flex items-center justify-center",
                    currentTheme.id === theme.id ? "border-cyber-cyan shadow-[0_0_10px_rgba(0,243,255,0.3)]" : "border-white/10 hover:border-white/30"
                  )}
                  style={{ backgroundColor: theme.bg }}
                  title={theme.name}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.cyan }} />
                </button>
              ))}
            </div>
          </section>

          {/* Modifier Panel */}
          {selectedObj && (
            <section className="cyber-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-cyber-lime border-b border-white/10 pb-2">
                <Grid3X3 className="w-3.5 h-3.5" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Modifiers</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/40 uppercase">Array Modifier</span>
                  <button 
                    onClick={() => {
                      const mods = selectedObj.modifiers || [];
                      const arrayMod = mods.find(m => m.type === 'array');
                      if (arrayMod) {
                        updateObject(selectedObj.id, { modifiers: mods.map(m => m.type === 'array' ? { ...m, enabled: !m.enabled } : m) });
                      } else {
                        updateObject(selectedObj.id, { modifiers: [...mods, { type: 'array', count: 3, offset: [2, 0, 0], enabled: true }] });
                      }
                    }}
                    className={cn("p-1 rounded transition-all", selectedObj.modifiers?.find(m => m.type === 'array')?.enabled ? "text-cyber-cyan" : "text-white/20")}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {selectedObj.modifiers?.find(m => m.type === 'array')?.enabled && (
                  <div className="space-y-2 p-2 bg-black/20 rounded border border-white/5">
                    <div className="flex justify-between text-[8px] text-white/30 uppercase">
                      <span>Count</span>
                      <span className="text-cyber-cyan">{selectedObj.modifiers.find(m => m.type === 'array')?.count}</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" step="1" 
                      value={selectedObj.modifiers.find(m => m.type === 'array')?.count || 1} 
                      onChange={(e) => {
                        const count = parseInt(e.target.value);
                        updateObject(selectedObj.id, { modifiers: selectedObj.modifiers?.map(m => m.type === 'array' ? { ...m, count } : m) });
                      }}
                      className="w-full accent-cyber-cyan" 
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/40 uppercase">Mirror Modifier</span>
                  <button 
                    onClick={() => {
                      const mods = selectedObj.modifiers || [];
                      const mirrorMod = mods.find(m => m.type === 'mirror');
                      if (mirrorMod) {
                        updateObject(selectedObj.id, { modifiers: mods.map(m => m.type === 'mirror' ? { ...m, enabled: !m.enabled } : m) });
                      } else {
                        updateObject(selectedObj.id, { modifiers: [...mods, { type: 'mirror', enabled: true }] });
                      }
                    }}
                    className={cn("p-1 rounded transition-all", selectedObj.modifiers?.find(m => m.type === 'mirror')?.enabled ? "text-cyber-cyan" : "text-white/20")}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/40 uppercase">Subdivision</span>
                  <button 
                    onClick={() => {
                      const mods = selectedObj.modifiers || [];
                      const subMod = mods.find(m => m.type === 'subdivision');
                      if (subMod) {
                        updateObject(selectedObj.id, { modifiers: mods.map(m => m.type === 'subdivision' ? { ...m, enabled: !m.enabled } : m) });
                      } else {
                        updateObject(selectedObj.id, { modifiers: [...mods, { type: 'subdivision', count: 2, enabled: true }] });
                      }
                    }}
                    className={cn("p-1 rounded transition-all", selectedObj.modifiers?.find(m => m.type === 'subdivision')?.enabled ? "text-cyber-cyan" : "text-white/20")}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {selectedObj.modifiers?.find(m => m.type === 'subdivision')?.enabled && (
                  <div className="space-y-2 p-2 bg-black/20 rounded border border-white/5">
                    <div className="flex justify-between text-[8px] text-white/30 uppercase">
                      <span>Levels</span>
                      <span className="text-cyber-cyan">{selectedObj.modifiers.find(m => m.type === 'subdivision')?.count}</span>
                    </div>
                    <input 
                      type="range" min="1" max="4" step="1" 
                      value={selectedObj.modifiers.find(m => m.type === 'subdivision')?.count || 1} 
                      onChange={(e) => {
                        const count = parseInt(e.target.value);
                        updateObject(selectedObj.id, { modifiers: selectedObj.modifiers?.map(m => m.type === 'subdivision' ? { ...m, count } : m) });
                      }}
                      className="w-full accent-cyber-cyan" 
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PCB Inspector */}
          {selectedObj?.type === 'pcb' && (
            <section className="cyber-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-cyber-lime border-b border-white/10 pb-2">
                <CircuitBoard className="w-3.5 h-3.5" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">PCB Inspector</h2>
              </div>
              <div className="space-y-2">
                <p className="text-[8px] text-white/30 uppercase font-bold">Layers</p>
                <div className="space-y-1">
                  {selectedObj.pcbData?.layers.map(layer => (
                    <div key={layer.id} className="flex items-center justify-between p-2 bg-black/40 border border-white/5 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: layer.color }} />
                        <span className="text-[9px] text-white/70">{layer.name}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newLayers = selectedObj.pcbData?.layers.map(l => 
                            l.id === layer.id ? { ...l, visible: !l.visible } : l
                          );
                          updateObject(selectedObj.id, { pcbData: { ...selectedObj.pcbData!, layers: newLayers! } });
                        }}
                        className={cn("p-1 rounded transition-all", layer.visible ? "text-cyber-cyan" : "text-white/20")}
                      >
                        {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[8px] text-white/30 uppercase font-bold">Components</p>
                <div className="grid grid-cols-2 gap-1">
                  {selectedObj.pcbData?.components.map(comp => (
                    <div key={comp.id} className="p-1.5 bg-black/20 border border-white/5 rounded text-[8px] text-white/50 flex items-center gap-1">
                      <Cpu className="w-2.5 h-2.5 text-cyber-cyan" />
                      {comp.name} ({comp.type.toUpperCase()})
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Drawing Toolbar */}
          {isDrawingMode && (
            <section className="cyber-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-cyber-cyan border-b border-white/10 pb-2">
                <Pencil className="w-3.5 h-3.5" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Grease Pencil</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] text-white/40 uppercase">
                    <span>Brush Color</span>
                    <span className="text-cyber-cyan">{brushColor}</span>
                  </div>
                  <input 
                    type="color" 
                    value={brushColor} 
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-full h-8 bg-transparent border-none cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] text-white/40 uppercase">
                    <span>Brush Size</span>
                    <span className="text-cyber-cyan">{brushSize}px</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="0.5" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                    className="w-full accent-cyber-cyan"
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-black/20 rounded border border-white/5">
                  <span className="text-[9px] text-white/40 uppercase">Surface Snapping</span>
                  <button 
                    onClick={() => setDrawOnSurface(!drawOnSurface)}
                    className={cn("p-1 rounded transition-all", drawOnSurface ? "text-cyber-cyan" : "text-white/20")}
                  >
                    {drawOnSurface ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      setObjects(objects.filter(o => o.type !== 'stroke'));
                      addLog("Grease Pencil: All strokes cleared.");
                    }}
                    className="py-2 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-bold uppercase rounded hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                  <button 
                    onClick={() => setIsDrawingMode(false)}
                    className="py-2 bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-[9px] font-bold uppercase rounded hover:bg-cyber-cyan hover:text-black transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="flex-1 cyber-card flex flex-col overflow-hidden">
            <div className="p-3 border-b border-cyber-cyan/20 flex items-center justify-between bg-cyber-cyan/5">
              <div className="flex items-center gap-2 text-cyber-cyan">
                <TerminalIcon className="w-3.5 h-3.5" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">Command Kernel</h2>
              </div>
            </div>
            <div className="flex-1 p-4 font-mono text-[9px] overflow-y-auto custom-scrollbar bg-black/40 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-white/40 leading-relaxed">
                  <span className="text-cyber-cyan/40 mr-2">❯</span>
                  {log}
                </div>
              ))}
            </div>
            <form onSubmit={handleCommand} className="p-2 bg-black/60 border-t border-white/10 flex items-center gap-2">
              <span className="text-cyber-cyan font-mono text-[10px]">❯</span>
              <input 
                type="text" 
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                placeholder="TYPE COMMAND..."
                className="flex-1 bg-transparent border-none text-[10px] font-mono focus:outline-none placeholder:text-white/10"
              />
              <Command className="w-3 h-3 text-white/20" />
            </form>
          </section>

          <section className="cyber-card p-4 flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyber-magenta">
                <Activity className="w-3.5 h-3.5" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]">AI Model Auditor</h2>
              </div>
              <button 
                onClick={handleProcessCAD} 
                disabled={isProcessing || !selectedObj}
                className={cn(
                  "p-1.5 bg-cyber-magenta/10 hover:bg-cyber-magenta/20 border border-cyber-magenta/30 rounded text-cyber-magenta transition-all",
                  isProcessing && "animate-spin"
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {analysis ? (
              <div className="space-y-4">
                <div className="p-3 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded">
                  <p className="text-[8px] text-cyber-cyan uppercase font-bold mb-1">AI Summary</p>
                  <div className="text-[9px] text-white/70 leading-relaxed italic prose-invert">
                    <Markdown>{analysis.summary}</Markdown>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-black/40 rounded border border-white/5">
                    <p className="text-[8px] text-white/30 uppercase">Volume</p>
                    <p className="text-sm font-mono text-cyber-cyan">{analysis.volume.toFixed(2)}</p>
                  </div>
                  <div className="p-2 bg-black/40 rounded border border-white/5">
                    <p className="text-[8px] text-white/30 uppercase">Efficiency</p>
                    <p className="text-sm font-mono text-cyber-lime">{(analysis.materialEfficiency * 100).toFixed(0)}%</p>
                  </div>
                  {analysis.blenderStats && (
                    <>
                      <div className="p-2 bg-black/40 rounded border border-white/5">
                        <p className="text-[8px] text-white/30 uppercase">Vertices</p>
                        <p className="text-xs font-mono text-white/60">{analysis.blenderStats.vertices}</p>
                      </div>
                      <div className="p-2 bg-black/40 rounded border border-white/5">
                        <p className="text-[8px] text-white/30 uppercase">Faces</p>
                        <p className="text-xs font-mono text-white/60">{analysis.blenderStats.faces}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-[9px] font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" /> Advantages
                    </h3>
                    <ul className="space-y-1">
                      {analysis.advantages?.map((adv, i) => (
                        <li key={i} className="text-[9px] text-white/60 leading-tight border-l border-cyber-cyan/30 pl-2 py-0.5">{adv}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-[9px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" /> Disadvantages
                    </h3>
                    <ul className="space-y-1">
                      {analysis.disadvantages?.map((dis, i) => (
                        <li key={i} className="text-[9px] text-white/60 leading-tight border-l border-red-400/30 pl-2 py-0.5">{dis}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-[9px] font-bold text-cyber-magenta uppercase tracking-wider flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" /> Modifications
                    </h3>
                    <ul className="space-y-1">
                      {analysis.modifications?.map((mod, i) => (
                        <li key={i} className="text-[9px] text-white/60 leading-tight border-l border-cyber-magenta/30 pl-2 py-0.5">{mod}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-24 flex flex-col items-center justify-center text-[9px] text-white/20 italic gap-2">
                <Search className="w-5 h-5 opacity-20" />
                <span>Run Deep Scan to analyze model integrity</span>
              </div>
            )}
            <button onClick={generateReport} className="w-full py-2 bg-white/5 border border-white/10 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Export Audit Report</button>
          </section>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 243, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 243, 255, 0.3); }
        input[type="range"] { -webkit-appearance: none; background: rgba(255,255,255,0.05); height: 2px; border-radius: 2px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; background: #00f3ff; border-radius: 50%; cursor: pointer; box-shadow: 0 0 10px #00f3ff; }
      `}</style>
    </div>
  );
}
