import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';

function App() {
  const [files, setFiles] = useState([]);
  const [events, setEvents] = useState([]);
  const draggableRef = useRef(null);

  useEffect(() => {
    console.log("앱 시작! 파일 감시 중...");

    // 1. 파일 감지 리스너 연결
    const removeListener = window.api.onFileAdded((filePath) => {
      const fileName = filePath.split(/[/\\]/).pop(); 
      if (fileName.startsWith('.')) return; 
      if (fileName.startsWith('~$')) return; 

      setFiles(prev => {
        if (prev.some(f => f.path === filePath)) return prev;
        return [...prev, { id: filePath, title: fileName, path: filePath }];
      });
    });

    // 2. 드래그 기능 설정 (변수에 담아둡니다)
    let draggable = null;
    if (draggableRef.current) {
      draggable = new Draggable(draggableRef.current, {
        itemSelector: '.draggable-item',
        eventData: function(eventEl) {
          return {
            title: eventEl.innerText,
            extendedProps: { path: eventEl.dataset.path }
          };
        }
      });
    }

    // 🧹 [여기가 핵심!] 앱이 꺼지거나 다시 그려질 때 청소하는 코드
    return () => {
      if (draggable) draggable.destroy(); // 드래그 기능 끄기 (중복 방지)
      // removeListener(); // 리스너 해제 (필요시 주석 해제)
    };
  }, []);

  const handleEventClick = (clickInfo) => {
    const filePath = clickInfo.event.extendedProps.path;
    if (filePath) window.api.openFile(filePath);
    else alert("⚠️ 파일 경로가 없습니다.");
  };

  const handleReceive = (info) => {
    // 1. FullCalendar 자동 생성 방지
    info.revert();

    const originalPath = info.draggedEl.dataset.path;
    
    // 2. 우리가 직접 데이터 추가
    const newEvent = {
      id: Date.now().toString() + Math.random(), // 더 확실한 고유 ID
      title: info.event.title,
      date: info.event.startStr,
      extendedProps: { path: originalPath }
    };

    // 3. State에 추가 (화면에 그리기)
    setEvents(prev => [...prev, newEvent]);

    // 4. 목록에서 제거
    setFiles(prev => prev.filter(f => f.path !== originalPath));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      <div style={{ flex: 7, padding: '20px' }}>
        <h2>📅 나의 스케줄</h2>
        <FullCalendar
          plugins={[ dayGridPlugin, interactionPlugin ]}
          initialView="dayGridMonth"
          height="90%"
          editable={true}
          droppable={true}
          events={events} 
          eventClick={handleEventClick}
          eventReceive={handleReceive}
        />
      </div>

      <div style={{ flex: 3, borderLeft: '1px solid #ddd', padding: '20px', backgroundColor: '#f9f9f9' }}>
        <h3>📂 대기 중인 문서 ({files.length}개)</h3>
        <p style={{fontSize: '12px', color: '#888'}}>
          드래그하면 달력에 추가됩니다.
        </p>
        
        <div ref={draggableRef} id="external-events">
          {files.map((file, index) => (
            <div
              key={index}
              className="draggable-item"
              data-path={file.path} 
              style={{ margin: '10px 0', padding: '10px', backgroundColor: 'white', border: '1px solid #ccc', cursor: 'move', borderRadius: '6px' }}
            >
              📄 {file.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;