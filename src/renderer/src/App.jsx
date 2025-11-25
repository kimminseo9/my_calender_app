import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';

const MacFolderIcon = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }}>
    <path d="M10,15 L40,15 L45,25 L90,25 C92.76,25 95,27.24 95,30 L95,85 C95,87.76 92.76,90 90,90 L10,90 C7.24,90 5,87.76 5,85 L5,20 C5,17.24 7.24,15 10,15 Z" fill="#7AA1D2" />
    <path d="M10,30 L90,30 C92.76,30 95,32.24 95,35 L95,85 C95,87.76 92.76,90 90,90 L10,90 C7.24,90 5,87.76 5,85 L5,35 C5,32.24 7.24,30 10,30 Z" fill="#8FB7E7" />
    <rect x="5" y="30" width="90" height="5" fill="#A4C8F0" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#555" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
  </svg>
);

function App() {
  const [files, setFiles] = useState([]);
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState('calendar');
  const [openedFolder, setOpenedFolder] = useState(null);

  const [memos, setMemos] = useState({});
  const [summaries, setSummaries] = useState({});
  
  // 💾 북마크 저장소 { 파일경로: [ {title, url, desc}, ... ] }
  const [bookmarks, setBookmarks] = useState({}); 

  const [summaryOpenState, setSummaryOpenState] = useState({});
  const [bookmarkOpenState, setBookmarkOpenState] = useState({});

  // 🆕 북마크 입력창 상태 (3개)
  const [inputTitle, setInputTitle] = useState(''); // 제목
  const [inputUrl, setInputUrl] = useState('');     // 링크
  const [inputDesc, setInputDesc] = useState('');   // 설명
  const [activeFileForBookmark, setActiveFileForBookmark] = useState(null);

  const draggableRef = useRef(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    if (viewMode === 'folder' && openedFolder) {
      openedFolder.files.forEach(async (file) => {
        if (summaries[file.path]) return;
        const summaryText = await window.api.getSummary(file.path);
        setSummaries(prev => {
          const newSummaries = { ...prev, [file.path]: summaryText };
          localStorage.setItem('fileSummaries', JSON.stringify(newSummaries));
          return newSummaries;
        });
      });
    }
  }, [viewMode, openedFolder]);

  useEffect(() => {
    console.log("🚀 앱 시작");
    const savedMemos = localStorage.getItem('fileMemos');
    if (savedMemos) setMemos(JSON.parse(savedMemos));
    const savedSummaries = localStorage.getItem('fileSummaries');
    if (savedSummaries) setSummaries(JSON.parse(savedSummaries));
    const savedBookmarks = localStorage.getItem('fileBookmarks');
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));

    setSummaryOpenState({});
    setBookmarkOpenState({});

    const removeListener = window.api.onFileAdded((filePath) => {
      const parts = filePath.split(/[/\\]/);
      const fileName = parts.pop();
      const parentFolder = parts.pop();
      const folderName = (parentFolder === 'my-docs') ? '기타 파일' : parentFolder;

      if (fileName.startsWith('.') || fileName.startsWith('~$')) return;

      setFiles(prev => {
        if (prev.some(f => f.path === filePath)) return prev;
        return [...prev, { id: filePath, path: filePath, title: fileName, folder: folderName }];
      });
    });

    if (draggableRef.current) {
      new Draggable(draggableRef.current, {
        itemSelector: '.draggable-item',
        eventData: function(eventEl) {
          return {
            title: eventEl.innerText,
            extendedProps: {
              path: eventEl.dataset.path,
              folder: eventEl.dataset.folder,
              fileName: eventEl.dataset.filename
            }
          };
        }
      });
    }
    return () => {};
  }, [viewMode]);

  const handleMemoChange = (filePath, text) => {
    const newMemos = { ...memos, [filePath]: text };
    setMemos(newMemos);
    localStorage.setItem('fileMemos', JSON.stringify(newMemos));
  };

  // 🆕 북마크 추가 핸들러 (제목, URL, 설명)
  const handleAddBookmark = (filePath) => {
    if (!inputUrl) return alert("URL을 입력해주세요!");
    if (!inputTitle) return alert("제목을 입력해주세요!");
    
    const newBookmark = { 
      title: inputTitle, 
      url: inputUrl, 
      desc: inputDesc 
    };
    
    const currentList = bookmarks[filePath] || [];
    const newList = [...currentList, newBookmark];

    const newBookmarksMap = { ...bookmarks, [filePath]: newList };
    setBookmarks(newBookmarksMap);
    localStorage.setItem('fileBookmarks', JSON.stringify(newBookmarksMap));

    // 입력창 초기화
    setInputTitle('');
    setInputUrl('');
    setInputDesc('');
  };

  const handleDeleteBookmark = (filePath, index) => {
    const currentList = bookmarks[filePath] || [];
    const newList = currentList.filter((_, i) => i !== index);
    const newBookmarksMap = { ...bookmarks, [filePath]: newList };
    setBookmarks(newBookmarksMap);
    localStorage.setItem('fileBookmarks', JSON.stringify(newBookmarksMap));
  };

  const openLink = (url) => {
    const target = url.startsWith('http') ? url : `https://${url}`;
    window.open(target, '_blank');
  };

  const handleDateClick = (arg) => {
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView('dayGridDay', arg.dateStr);
    }
  };

  const handleEventClick = (clickInfo) => {
    const folderFiles = clickInfo.event.extendedProps.files || [];
    const folderName = clickInfo.event.title;
    setOpenedFolder({ title: folderName, files: folderFiles });
    setViewMode('folder');
  };

  const handleReceive = (info) => {
    info.revert();
    const { path, folder, fileName } = info.event.extendedProps;
    const safePath = path || info.draggedEl.dataset.path;
    const safeFolder = folder || info.draggedEl.dataset.folder;
    const safeFileName = fileName || info.draggedEl.dataset.filename;
    const dropDate = info.event.startStr;

    if (!safeFolder) return;

    const newFile = { path: safePath, fileName: safeFileName, folder: safeFolder };

    setEvents(prevEvents => {
      const existingIndex = prevEvents.findIndex(evt => evt.date === dropDate && evt.title === safeFolder);
      if (existingIndex !== -1) {
        const newEvents = [...prevEvents];
        const existingEvent = newEvents[existingIndex];
        const existingFiles = existingEvent.extendedProps.files || [];
        if (!existingFiles.some(f => f.path === safePath)) {
          newEvents[existingIndex] = {
            ...existingEvent,
            extendedProps: { ...existingEvent.extendedProps, files: [...existingFiles, newFile] }
          };
        }
        return newEvents;
      } else {
        return [...prevEvents, {
          id: Date.now().toString() + Math.random(),
          title: safeFolder,
          date: dropDate,
          extendedProps: { files: [newFile] },
          backgroundColor: 'transparent',
          borderColor: 'transparent'
        }];
      }
    });
    setFiles(prev => prev.filter(f => f.path !== safePath));
  };

  const toggleSummary = (filePath, e) => {
    e.stopPropagation();
    setSummaryOpenState(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const toggleBookmark = (filePath, e) => {
    e.stopPropagation();
    setBookmarkOpenState(prev => ({ ...prev, [filePath]: !prev[filePath] }));
    setActiveFileForBookmark(filePath); 
  };

  const renderEventContent = (eventInfo) => {
    const files = eventInfo.event.extendedProps.files || [];
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%', height: '100%', padding: '2px 4px', cursor: 'pointer', overflow: 'hidden' }}>
        <div style={{ width: '16px', height: '16px', marginRight: '6px', flexShrink: 0 }}><MacFolderIcon /></div>
        <div style={{ color: '#333', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {eventInfo.event.title} <span style={{ fontWeight: 'normal', color: '#666', marginLeft: '4px' }}>({files.length})</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>

      <div style={{ flex: 7, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {viewMode === 'calendar' && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
              <h2 style={{margin: 0}}>📅 나의 스케줄</h2>
              <button
                onClick={() => calendarRef.current.getApi().changeView('dayGridMonth')}
                style={{padding: '8px 12px', cursor: 'pointer', background:'#333', color:'white', border:'none', borderRadius:'6px'}}
              >
                전체 보기 (Month)
              </button>
            </div>
            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <FullCalendar
                ref={calendarRef}
                plugins={[ dayGridPlugin, interactionPlugin ]}
                initialView="dayGridMonth"
                height="100%"
                editable={false}
                droppable={true}
                events={events}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                eventReceive={handleReceive}
                eventContent={renderEventContent}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                dayMaxEventRows={true}
              />
            </div>
          </div>
        )}

        {viewMode === 'folder' && openedFolder && (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#f5f5f7', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '20px 30px', backgroundColor: 'white', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' }}>
              <button
                onClick={() => setViewMode('calendar')}
                style={{ marginRight: '20px', padding: '8px 16px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                ← 뒤로가기
              </button>
              <div style={{ width: '32px', height: '32px', marginRight: '10px' }}><MacFolderIcon /></div>
              <h1 style={{ margin: 0, fontSize: '22px' }}>{openedFolder.title}</h1>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '10px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', minHeight: '100%' }}>

                {openedFolder.files.map((file, idx) => {
                  const isSummaryOpen = summaryOpenState[file.path];
                  const isBookmarkOpen = bookmarkOpenState[file.path];
                  const fileBookmarks = bookmarks[file.path] || [];

                  return (
                    <div
                      key={idx}
                      onClick={() => window.api.openFile(file.path)}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        padding: '15px 10px', borderBottom: '1px solid #eee', cursor: 'pointer', transition: '0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* [1층] 아이콘 + 이름 + 메모 */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '6px' }}>
                        <FileIcon />
                        <span style={{ marginLeft: '12px', fontSize: '16px', fontWeight: 'bold', color: '#333', flex: 1 }}>
                          {file.fileName}
                        </span>

                        <div style={{ width: '300px', display: 'flex', alignItems: 'center', marginLeft:'20px' }}>
                          <span style={{ fontSize: '12px', color: '#999', marginRight: '8px' }}>📝 Memo:</span>
                          <input
                            type="text"
                            placeholder="나만의 메모..."
                            value={memos[file.path] || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleMemoChange(file.path, e.target.value)}
                            style={{
                              flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd',
                              fontSize: '13px', backgroundColor: '#fff8dc'
                            }}
                          />
                        </div>
                      </div>

                      {/* [2층] 버튼들 */}
                      <div style={{ paddingLeft: '38px', marginBottom: '4px', display:'flex', gap:'15px' }}>
                        <button
                          onClick={(e) => toggleSummary(file.path, e)}
                          style={{
                            padding: '2px 0px', fontSize: '12px', cursor: 'pointer',
                            border: 'none', background: 'none', color: '#555', fontWeight: '500'
                          }}
                        >
                          {isSummaryOpen ? '📄 요약 접기 🔼' : '📄 요약 보기 🔽'}
                        </button>
                        
                        <button
                          onClick={(e) => toggleBookmark(file.path, e)}
                          style={{
                            padding: '2px 0px', fontSize: '12px', cursor: 'pointer',
                            border: 'none', background: 'none', color: '#007bff', fontWeight: '500'
                          }}
                        >
                          {isBookmarkOpen ? '🔗 북마크 접기 🔼' : `🔗 북마크 관리 (${fileBookmarks.length}) 🔽`}
                        </button>
                      </div>

                      {/* [3층-A] 요약 */}
                      {isSummaryOpen && (
                        <div style={{
                          marginLeft: '38px', marginRight: '20px', padding: '15px', backgroundColor: '#f8f9fa',
                          borderRadius: '6px', fontSize: '13px', color: '#555', lineHeight: '1.6',
                          borderLeft: '4px solid #7AA1D2', marginTop: '5px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{fontWeight: 'bold', marginBottom: '8px', color: '#7AA1D2'}}>💡 AI 자동 요약</div>
                          {summaries[file.path] ? summaries[file.path] : "⏳ 문서 내용을 분석하고 있습니다..."}
                        </div>
                      )}

                      {/* [3층-B] 북마크 관리 */}
                      {isBookmarkOpen && (
                        <div style={{
                          marginLeft: '38px', marginRight: '20px', padding: '15px', backgroundColor: '#eef5ff',
                          borderRadius: '6px', fontSize: '13px', color: '#333', lineHeight: '1.6',
                          borderLeft: '4px solid #007bff', marginTop: '5px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{fontWeight: 'bold', marginBottom: '10px', color: '#007bff'}}>🔗 관련 링크</div>
                          
                          {/* 링크 목록 */}
                          <ul style={{listStyle:'none', padding:0, margin:'0 0 15px 0'}}>
                            {fileBookmarks.map((bm, i) => (
                              <li key={i} style={{marginBottom:'8px', display:'flex', alignItems:'center', background:'white', padding:'8px', borderRadius:'4px', border:'1px solid #dee2e6'}}>
                                <div style={{flex:1, display:'flex', flexDirection:'column', cursor:'pointer'}} onClick={() => openLink(bm.url)}>
                                  <span style={{fontWeight:'bold', color:'#0056b3', fontSize:'14px'}}>{bm.title}</span>
                                  <span style={{fontSize:'11px', color:'#999'}}>{bm.url}</span>
                                  {bm.desc && <span style={{fontSize:'12px', color:'#555', marginTop:'2px'}}>└ {bm.desc}</span>}
                                </div>
                                <button 
                                  onClick={() => handleDeleteBookmark(file.path, i)}
                                  style={{marginLeft:'10px', border:'none', background:'none', cursor:'pointer', color:'#ff4d4f'}}
                                >
                                  ✖
                                </button>
                              </li>
                            ))}
                            {fileBookmarks.length === 0 && <li style={{color:'#999', fontSize:'12px'}}>저장된 링크가 없습니다.</li>}
                          </ul>

                          {/* 링크 추가 폼 (3단 입력) */}
                          <div style={{display:'flex', flexDirection:'column', gap:'8px', background:'white', padding:'10px', borderRadius:'4px', border:'1px solid #ddd'}}>
                            <div style={{display:'flex', gap:'8px'}}>
                              <input 
                                type="text" placeholder="제목 (예: 참고 논문)"
                                value={activeFileForBookmark === file.path ? inputTitle : ''}
                                onChange={(e) => { setActiveFileForBookmark(file.path); setInputTitle(e.target.value); }}
                                style={{flex:1, padding:'6px', borderRadius:'4px', border:'1px solid #ccc'}}
                              />
                              <input 
                                type="text" placeholder="URL (예: google.com)"
                                value={activeFileForBookmark === file.path ? inputUrl : ''}
                                onChange={(e) => { setActiveFileForBookmark(file.path); setInputUrl(e.target.value); }}
                                style={{flex:2, padding:'6px', borderRadius:'4px', border:'1px solid #ccc'}}
                              />
                            </div>
                            <div style={{display:'flex', gap:'8px'}}>
                              <input 
                                type="text" placeholder="설명 (선택사항)"
                                value={activeFileForBookmark === file.path ? inputDesc : ''}
                                onChange={(e) => { setActiveFileForBookmark(file.path); setInputDesc(e.target.value); }}
                                style={{flex:1, padding:'6px', borderRadius:'4px', border:'1px solid #ccc'}}
                              />
                              <button 
                                onClick={() => handleAddBookmark(file.path)}
                                style={{padding:'6px 20px', background:'#007bff', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}
                              >
                                추가
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}

                {openedFolder.files.length === 0 && <p style={{color:'#999', textAlign:'center', marginTop: '50px'}}>폴더가 비어있습니다.</p>}
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={{ flex: 3, borderLeft: '1px solid #eee', padding: '20px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{marginTop: 0}}>📂 파일함</h3>
        <div ref={draggableRef} style={{ flex: 1, overflowY: 'auto' }}>
          {files.map((file, index) => (
            <div
              key={index}
              className="draggable-item"
              data-path={file.path}
              data-folder={file.folder}
              data-filename={file.title}
              style={{ margin: '8px 0', padding: '10px', backgroundColor: 'white', border: '1px solid #e0e0e0', cursor: 'grab', borderRadius: '6px', display:'flex', alignItems:'center' }}
            >
              <div style={{width:'20px', height:'20px', marginRight:'8px'}}><MacFolderIcon/></div>
              <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                <span style={{fontWeight:'bold', color:'#007bff', fontSize:'12px', marginRight:'4px'}}>[{file.folder}]</span>
                <span style={{fontSize:'13px'}}>{file.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;