import { useEffect, useRef, useState } from 'react';
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

function SortableItem({ item, justMovedId }) {
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
    opacity: isDragging ? 0 : 1,
  };

  const className = `ranked-item${item.id === justMovedId ? ' just-moved' : ''}`;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
      <div className="photo-wrapper">
        <img src={item.foto_url} alt={item.nombre} className="ranked-photo" />
      </div>
      <div className="ranked-info">
        <h3>{item.nombre}</h3>
        {item.subtitulo && <p className="subtitulo">{item.subtitulo}</p>}
      </div>
      <div className="ranked-position">
        {item.posicion_ranking === 1 && <span className="position-emoji">❤️</span>}
        {item.posicion_ranking > 1 && item.cambio_posicion === 'up' && <span className="arrow-up">⬆️</span>}
        {item.posicion_ranking > 1 && item.cambio_posicion === 'down' && <span className="arrow-down">⬇️</span>}
        <span className="number">{item.posicion_ranking}</span>
      </div>
    </div>
  );
}

function PlaceholderItem() {
  return <div className="placeholder-space" style={{ height: '83px' }} />;
}

function DraggableUnrankedItem({ item, justMovedId }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0 : 1,
  };

  const className = `unranked-item${item.id === justMovedId ? ' just-moved' : ''}`;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
      <div className="photo-wrapper">
        {item.foto_url ? (
          <img src={item.foto_url} alt={item.nombre} className="ranked-photo" />
        ) : (
          <div className="unranked-circle">{item.nombre.charAt(0).toUpperCase()}</div>
        )}
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
    <div ref={setNodeRef} className={`ranked-drop-zone ${isActive ? 'active' : ''}`}>
      {isActive && 'Suelta aquí para agregar al ranking'}
    </div>
  );
}

function RankedDropEndZone({ show }) {
  const { setNodeRef } = useDroppable({ id: 'ranked-drop-end-zone' });
  return <div ref={setNodeRef} className="ranked-drop-end-zone" style={{ height: show ? '48px' : '0', overflow: 'hidden' }} />;
}

function UnrankedDropZone({ show }) {
  const { setNodeRef } = useDroppable({ id: 'unranked-drop-zone' });
  return (
    <div
      ref={setNodeRef}
      className={`unranked-drop-zone ${show ? 'active' : ''}`}
      style={show ? {} : { height: 0, minHeight: 0, border: 'none', padding: 0, overflow: 'hidden' }}
    >
      {show && 'Suelta aquí para quitar del ranking'}
    </div>
  );
}

function App() {
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [justMovedId, setJustMovedId] = useState(null);
  const originalPositionsRef = useRef({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { fetchData(); }, []);

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
    const positions = {};
    items.forEach(item => {
      if (item.posicion_ranking !== null) positions[item.id] = item.posicion_ranking;
    });
    originalPositionsRef.current = positions;
  }

  function handleDragOver(event) {
    const { active, over } = event;
    setOverId(over?.id || null);

    if (!over || active.id === over.id) return;

    const activeItem = items.find(item => item.id === active.id);
    const overItem = items.find(item => item.id === over.id);

    // Live-reorder ranked items as you drag — only update array order, not posicion_ranking yet
    if (activeItem?.posicion_ranking !== null && overItem?.posicion_ranking !== null) {
      setItems(current => {
        const ranked = current.filter(item => item.posicion_ranking !== null);
        const oldIndex = ranked.findIndex(item => item.id === active.id);
        const newIndex = ranked.findIndex(item => item.id === over.id);
        if (oldIndex === newIndex) return current;
        const unranked = current.filter(item => item.posicion_ranking === null);
        return [...arrayMove(ranked, oldIndex, newIndex), ...unranked];
      });
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeSnapshot = items.find(item => item.id === active.id);
    const overSnapshot = items.find(item => item.id === over.id);
    const wasRanked = activeSnapshot?.posicion_ranking !== null;
    const isCrossSection =
      (wasRanked && over.id === 'unranked-drop-zone') ||
      (!wasRanked && (over.id === 'ranked-drop-zone' || over.id === 'ranked-drop-end-zone')) ||
      (!wasRanked && overSnapshot?.posicion_ranking !== null);

    let dbUpdates = null;

    setItems(current => {
      const activeItem = current.find(item => item.id === active.id);
      if (!activeItem) return current;

      // ── Add to end of ranked ──────────────────────────────────────────
      if (over.id === 'ranked-drop-zone' || over.id === 'ranked-drop-end-zone') {
        if (activeItem.posicion_ranking !== null) return current;
        const ranked = current.filter(item => item.posicion_ranking !== null);
        const unranked = current.filter(item => item.posicion_ranking === null && item.id !== active.id);
        const newPos = ranked.length + 1;
        const rankedItem = { ...activeItem, posicion_ranking: newPos, cambio_posicion: null };
        dbUpdates = [{ id: active.id, posicion_ranking: newPos, cambio_posicion: null }];
        return [...ranked, rankedItem, ...unranked];
      }

      // ── Move to unranked ──────────────────────────────────────────────
      if (over.id === 'unranked-drop-zone') {
        if (activeItem.posicion_ranking === null) return current;
        const ranked = current.filter(item => item.posicion_ranking !== null && item.id !== active.id)
          .map((item, i) => ({ ...item, posicion_ranking: i + 1, cambio_posicion: null }));
        const unranked = current.filter(item => item.posicion_ranking === null);
        const unrankedItem = { ...activeItem, posicion_ranking: null, cambio_posicion: null };
        dbUpdates = [
          { id: active.id, posicion_ranking: null, cambio_posicion: null },
          ...ranked.map(item => ({ id: item.id, posicion_ranking: item.posicion_ranking, cambio_posicion: null })),
        ];
        return [...ranked, ...unranked, unrankedItem];
      }

      const overItem = current.find(item => item.id === over.id);
      if (!overItem) return current;

      // ── Unranked → insert into ranked ────────────────────────────────
      if (activeItem.posicion_ranking === null && overItem.posicion_ranking !== null) {
        const ranked = current.filter(item => item.posicion_ranking !== null);
        const unranked = current.filter(item => item.posicion_ranking === null && item.id !== active.id);
        const idx = ranked.findIndex(item => item.id === over.id);
        const newRanked = [
          ...ranked.slice(0, idx),
          { ...activeItem, cambio_posicion: null },
          ...ranked.slice(idx),
        ].map((item, i) => ({ ...item, posicion_ranking: i + 1 }));
        dbUpdates = newRanked.map(item => ({ id: item.id, posicion_ranking: item.posicion_ranking, cambio_posicion: null }));
        return [...newRanked, ...unranked];
      }

      // ── Ranked reorder (live-sorted by handleDragOver) ───────────────
      if (activeItem.posicion_ranking !== null && overItem.posicion_ranking !== null) {
        const ranked = current.filter(item => item.posicion_ranking !== null);
        const unranked = current.filter(item => item.posicion_ranking === null);
        const updated = ranked.map((item, i) => {
          const newPos = i + 1;
          const origPos = originalPositionsRef.current[item.id] ?? item.posicion_ranking;
          let cambioPos = null;
          if (newPos < origPos) cambioPos = 'up';
          else if (newPos > origPos) cambioPos = 'down';
          return { ...item, posicion_ranking: newPos, cambio_posicion: cambioPos };
        });
        dbUpdates = updated.map(item => ({ id: item.id, posicion_ranking: item.posicion_ranking, cambio_posicion: item.cambio_posicion }));
        return [...updated, ...unranked];
      }

      return current;
    });

    if (isCrossSection) {
      setJustMovedId(active.id);
      setTimeout(() => setJustMovedId(null), 350);
    }

    // DB sync after state is settled
    if (dbUpdates) {
      for (const row of dbUpdates) {
        await supabase.from('items_ranking')
          .update({ posicion_ranking: row.posicion_ranking, cambio_posicion: row.cambio_posicion })
          .eq('id', row.id);
      }
    }
  }

  const rankeados = items.filter(item => item.posicion_ranking !== null);
  const noRankeados = items.filter(item => item.posicion_ranking === null);
  const activeItem = activeId ? items.find(item => item.id === activeId) : null;
  const isDraggingRanked = activeItem && activeItem.posicion_ranking !== null;
  const isDraggingUnranked = activeItem && activeItem.posicion_ranking === null;

  const overItem = overId ? items.find(item => item.id === overId) : null;
  const showPlaceholder = isDraggingUnranked && overItem && overItem.posicion_ranking !== null;

  let displayRanked = [...rankeados];
  if (showPlaceholder && activeItem) {
    const insertIndex = displayRanked.findIndex(item => item.id === overId);
    displayRanked.splice(insertIndex, 0, { id: 'placeholder-space', isPlaceholder: true });
  }

  const rankedIds = displayRanked.filter(i => !i.isPlaceholder).map(i => i.id);

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <span className="trophy-icon">🏆</span>
          <div className="header-text">
            {config?.subtitulo_principal && (
              <p className="header-top-label">{config.subtitulo_principal}</p>
            )}
            <h1>{config?.titulo_principal || 'RANKING'}</h1>
          </div>
          <span className="trophy-icon">🏆</span>
        </div>

        <h2 className="section-title">{config?.texto_ranked || 'Posiciones'}</h2>

        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const activeItem = items.find(item => item.id === args.active.id);
            if (activeItem?.posicion_ranking === null) {
              const validIds = new Set([...rankeados.map(i => i.id), 'ranked-drop-zone', 'ranked-drop-end-zone']);
              const filteredRects = new Map();
              args.droppableRects.forEach((rect, id) => { if (validIds.has(id)) filteredRects.set(id, rect); });
              return closestCenter({ ...args, droppableRects: filteredRects });
            }
            if (activeItem?.posicion_ranking !== null) {
              const validIds = new Set([...rankeados.map(i => i.id), 'unranked-drop-zone']);
              const filteredRects = new Map();
              args.droppableRects.forEach((rect, id) => { if (validIds.has(id)) filteredRects.set(id, rect); });
              return closestCenter({ ...args, droppableRects: filteredRects });
            }
            return closestCenter(args);
          }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rankedIds} strategy={verticalListSortingStrategy}>
            <div className="ranked-section">
              {displayRanked.length > 0 ? (
                <>
                  {displayRanked.map((item) =>
                    item.isPlaceholder ? (
                      <PlaceholderItem key={item.id} />
                    ) : (
                      <SortableItem key={item.id} item={item} justMovedId={justMovedId} />
                    )
                  )}
                  <RankedDropEndZone show={isDraggingUnranked} />
                </>
              ) : (
                <RankedDropZone isActive={isDraggingUnranked} />
              )}
            </div>
          </SortableContext>

          <h2 className="section-title unranked-title">{config?.texto_unranked || 'Sin rankear'}</h2>

          <div className="unranked-section">
            <UnrankedDropZone show={isDraggingRanked} />
            {noRankeados.map((item) => (
              <DraggableUnrankedItem key={item.id} item={item} justMovedId={justMovedId} />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeItem ? (
              <div className="ranked-item dragging">
                <div className="photo-wrapper">
                  {activeItem.foto_url ? (
                    <img src={activeItem.foto_url} alt={activeItem.nombre} className="ranked-photo" />
                  ) : (
                    <div className="unranked-circle">{activeItem.nombre.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="ranked-info">
                  <h3>{activeItem.nombre}</h3>
                  {activeItem.subtitulo && <p className="subtitulo">{activeItem.subtitulo}</p>}
                </div>
                <div className="ranked-position">
                  <span className="number">?</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

export default App;
