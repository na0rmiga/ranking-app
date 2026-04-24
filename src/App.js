import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './App.css';

function SortableItem({ item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="ranked-item"
    >
      <img src={item.foto_url} alt={item.nombre} className="ranked-photo" />
      <div className="ranked-info">
        <h3>{item.nombre}</h3>
        {item.subtitulo && <p className="subtitulo">{item.subtitulo}</p>}
      </div>
      <div className="ranked-position">
        <span className="number">{item.posicion_ranking}</span>
        {item.posicion_ranking === 1 && <span className="star-icon">⭐</span>}
        {item.posicion_ranking > 1 && item.cambio_posicion === 'up' && <span className="arrow-up">⬆️</span>}
        {item.posicion_ranking > 1 && item.cambio_posicion === 'down' && <span className="arrow-down">⬇️</span>}
      </div>
    </div>
  );
}

function PlaceholderItem() {
  const {
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: 'placeholder-space' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: '89px', // Altura de un ranked-item
    margin: '0',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="placeholder-space"
    />
  );
}

function DraggableUnrankedItem({ item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: item.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0 : 1,  // Invisible mientras se arrastra
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="unranked-item"
    >
      <div className="unranked-circle">
        {item.nombre.charAt(0).toUpperCase()}
      </div>
      <div className="unranked-info">
        <h4>{item.nombre}</h4>
        {item.subtitulo && <p className="subtitulo-small">{item.subtitulo}</p>}
      </div>
    </div>
  );
}

function RankedDropZone({ isActive }) {
  const { setNodeRef } = useDroppable({ id: 'ranked-drop-zone' });

  return (
    <div 
      ref={setNodeRef} 
      className={`ranked-drop-zone ${isActive ? 'active' : ''}`}
    >
      {isActive && 'Suelta aquí para agregar al ranking'}
    </div>
  );
}

function UnrankedDropZone({ isActive }) {
  const { setNodeRef } = useDroppable({ id: 'unranked-drop-zone' });

  return (
    <div 
      ref={setNodeRef} 
      className={`unranked-drop-zone ${isActive ? 'active' : ''}`}
    >
      {isActive && 'Suelta aquí para quitar del ranking'}
    </div>
  );
}

function App() {
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('items_ranking')
        .select('*')
        .order('posicion_ranking', { ascending: true, nullsFirst: false });
      
      if (itemsError) throw itemsError;

      const { data: configData, error: configError } = await supabase
        .from('config')
        .select('*')
        .limit(1)
        .single();
      
      if (configError) throw configError;

      setItems(itemsData);
      setConfig(configData);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event) {
    setOverId(event.over?.id || null);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeItem = items.find(item => item.id === active.id);
    if (!activeItem) return;

    // Si lo sueltan en la zona de ranked (cuando ranked está vacío)
    if (over.id === 'ranked-drop-zone') {
      if (activeItem.posicion_ranking === null) {
        const rankeados = items.filter(item => item.posicion_ranking !== null);
        const noRankeados = items.filter(item => item.posicion_ranking === null && item.id !== activeItem.id);
        
        const rankedItem = {
          ...activeItem,
          posicion_ranking: rankeados.length + 1,
          cambio_posicion: 'up',
        };

        setItems([...rankeados, rankedItem, ...noRankeados]);

        await supabase
          .from('items_ranking')
          .update({ posicion_ranking: rankeados.length + 1, cambio_posicion: 'up' })
          .eq('id', activeItem.id);
      }
      return;
    }

    // Si lo sueltan en la zona de unranked
    if (over.id === 'unranked-drop-zone') {
      if (activeItem.posicion_ranking !== null) {
        const rankeados = items.filter(item => item.posicion_ranking !== null && item.id !== activeItem.id);
        const noRankeados = items.filter(item => item.posicion_ranking === null);

        const updatedRankeados = rankeados.map((item, index) => {
          const newPosition = index + 1;
          const oldPosition = item.posicion_ranking;
          
          let cambioPos = item.cambio_posicion;
          if (newPosition < oldPosition) {
            cambioPos = 'up';
          }

          return {
            ...item,
            posicion_ranking: newPosition,
            cambio_posicion: cambioPos,
          };
        });

        const unrankedItem = {
          ...activeItem,
          posicion_ranking: null,
          cambio_posicion: null,
        };

        setItems([...updatedRankeados, ...noRankeados, unrankedItem]);

        await supabase
          .from('items_ranking')
          .update({ posicion_ranking: null, cambio_posicion: null })
          .eq('id', activeItem.id);

        for (const item of updatedRankeados) {
          await supabase
            .from('items_ranking')
            .update({ 
              posicion_ranking: item.posicion_ranking,
              cambio_posicion: item.cambio_posicion 
            })
            .eq('id', item.id);
        }
      }
      return;
    }

    const overItem = items.find(item => item.id === over.id);
    if (!overItem) return;

    // Si es un item unranked arrastrándose sobre un ranked
    if (activeItem.posicion_ranking === null && overItem.posicion_ranking !== null) {
      const rankeados = items.filter(item => item.posicion_ranking !== null);
      const noRankeados = items.filter(item => item.posicion_ranking === null && item.id !== activeItem.id);
      
      const newPosition = overItem.posicion_ranking;
      rankeados.splice(newPosition - 1, 0, activeItem);

      const updatedRankeados = rankeados.map((item, index) => {
        const newPos = index + 1;
        const oldPos = item.posicion_ranking;
        
        let cambioPos = null;
        
        if (item.id === activeItem.id) {
          cambioPos = 'up';
        } else if (oldPos !== null && newPos > oldPos) {
          cambioPos = 'down';
        } else if (oldPos !== null && newPos < oldPos) {
          cambioPos = 'up';
        } else {
          cambioPos = item.cambio_posicion;
        }

        return {
          ...item,
          posicion_ranking: newPos,
          cambio_posicion: cambioPos,
        };
      });

      setItems([...updatedRankeados, ...noRankeados]);

      for (const item of updatedRankeados) {
        await supabase
          .from('items_ranking')
          .update({ 
            posicion_ranking: item.posicion_ranking,
            cambio_posicion: item.cambio_posicion 
          })
          .eq('id', item.id);
      }
      return;
    }

    // Si ambos son ranked (reordenar)
    if (active.id !== over.id && activeItem.posicion_ranking !== null && overItem.posicion_ranking !== null) {
      const rankeados = items.filter(item => item.posicion_ranking !== null);
      const oldIndex = rankeados.findIndex(item => item.id === active.id);
      const newIndex = rankeados.findIndex(item => item.id === over.id);

      const newRankeados = arrayMove(rankeados, oldIndex, newIndex);

      const updatedRankeados = newRankeados.map((item, index) => {
        const newPosition = index + 1;
        const oldPosition = item.posicion_ranking;
        
        let cambioPos = item.cambio_posicion;
        
        if (item.id === active.id) {
          if (newPosition < oldPosition) {
            cambioPos = 'up';
          } else if (newPosition > oldPosition) {
            cambioPos = 'down';
          }
        } else {
          if (newPosition > oldPosition) {
            cambioPos = 'down';
          } else if (newPosition < oldPosition) {
            cambioPos = 'up';
          }
        }

        return {
          ...item,
          posicion_ranking: newPosition,
          cambio_posicion: cambioPos,
        };
      });

      const noRankeados = items.filter(item => item.posicion_ranking === null);
      setItems([...updatedRankeados, ...noRankeados]);

      for (const item of updatedRankeados) {
        await supabase
          .from('items_ranking')
          .update({ 
            posicion_ranking: item.posicion_ranking,
            cambio_posicion: item.cambio_posicion 
          })
          .eq('id', item.id);
      }
    }
  }

  const rankeados = items.filter(item => item.posicion_ranking !== null);
  const noRankeados = items.filter(item => item.posicion_ranking === null);
  
  const activeItem = activeId ? items.find(item => item.id === activeId) : null;
  const isDraggingRanked = activeItem && activeItem.posicion_ranking !== null;
  const isDraggingUnranked = activeItem && activeItem.posicion_ranking === null;
  
  // Crear lista con placeholder si estamos arrastrando unranked sobre ranked
  const overItem = overId ? items.find(item => item.id === overId) : null;
  const showPlaceholder = isDraggingUnranked && overItem && overItem.posicion_ranking !== null;
  
  let displayRanked = [...rankeados];
  if (showPlaceholder && activeItem) {
    const insertIndex = displayRanked.findIndex(item => item.id === overId);
    const placeholder = { id: 'placeholder-space', isPlaceholder: true };
    displayRanked.splice(insertIndex, 0, placeholder);
  }
  
  const rankedIds = displayRanked.map(i => i.isPlaceholder ? i.id : i.id);

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <span className="trophy-icon">🏆</span>
          <div className="header-text">
            <h1>{config?.titulo_principal || 'RANKING'}</h1>
            <p className="subtitle-header">{config?.subtitulo_principal || ''}</p>
          </div>
          <span className="trophy-icon">🏆</span>
        </div>

        <h2 className="section-title">{config?.texto_ranked || 'Ranked'}</h2>
        
        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const activeItem = items.find(item => item.id === args.active.id);
            
            if (activeItem && activeItem.posicion_ranking === null) {
              const rankedIds = rankeados.map(i => i.id);
              const validIds = new Set([...rankedIds, 'ranked-drop-zone']);
              
              const filteredRects = new Map();
              args.droppableRects.forEach((rect, id) => {
                if (validIds.has(id)) {
                  filteredRects.set(id, rect);
                }
              });
              
              return closestCenter({
                ...args,
                droppableRects: filteredRects
              });
            }
            
            if (activeItem && activeItem.posicion_ranking !== null) {
              const rankedIds = rankeados.map(i => i.id);
              const validIds = new Set([...rankedIds, 'unranked-drop-zone']);
              
              const filteredRects = new Map();
              args.droppableRects.forEach((rect, id) => {
                if (validIds.has(id)) {
                  filteredRects.set(id, rect);
                }
              });
              
              return closestCenter({
                ...args,
                droppableRects: filteredRects
              });
            }
            
            return closestCenter(args);
          }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rankedIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="ranked-section">
              {displayRanked.length > 0 ? (
                displayRanked.map((item) => (
                  item.isPlaceholder ? (
                    <PlaceholderItem key={item.id} item={item} />
                  ) : (
                    <SortableItem key={item.id} item={item} />
                  )
                ))
              ) : (
                <RankedDropZone isActive={isDraggingUnranked} />
              )}
            </div>
          </SortableContext>

          <h2 className="section-title unranked-title">{config?.texto_unranked || 'Unranked'}</h2>
          
          <div className="unranked-section">
            {noRankeados.length > 0 ? (
              <>
                {isDraggingRanked && <UnrankedDropZone isActive={true} />}
                {noRankeados.map((item) => (
                  <DraggableUnrankedItem key={item.id} item={item} />
                ))}
              </>
            ) : (
              <UnrankedDropZone isActive={isDraggingRanked} />
            )}
          </div>
          <DragOverlay>
            {activeItem ? (
              <div className={activeItem.posicion_ranking ? "ranked-item dragging" : "unranked-item dragging"}>
                {activeItem.posicion_ranking ? (
                  <>
                    <img src={activeItem.foto_url} alt={activeItem.nombre} className="ranked-photo" />
                    <div className="ranked-info">
                      <h3>{activeItem.nombre}</h3>
                      {activeItem.subtitulo && <p className="subtitulo">{activeItem.subtitulo}</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="unranked-circle">
                      {activeItem.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="unranked-info">
                      <h4>{activeItem.nombre}</h4>
                      {activeItem.subtitulo && <p className="subtitulo-small">{activeItem.subtitulo}</p>}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        
      </div>
    </div>
  );
}

export default App;