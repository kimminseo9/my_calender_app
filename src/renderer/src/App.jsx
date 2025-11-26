import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';

// 📂 [디자인] 맥북 폴더 아이콘
const MacFolderIcon = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }}>
    <path d="M10,15 L40,15 L45,25 L90,25 C92.76,25 95,27.24 95,30 L95,85 C95,87.76 92.76,90 90,90 L10,90 C7.24,90 5,87.76 5,85 L5,20 C5,17.24 7.24,15 10,15 Z" fill="#7AA1D2" />
    <path d="M10,30 L90,30 C92.76,30 95,32.24 95,35 L95,85 C95,87.76 92.76,90 90,90 L10,90 C7.24,90 5,87.76 5,85 L5,35 C5,32.24 7.24,30 10,30 Z" fill="#8FB7E7" />
    <rect x="5" y="30" width="90" height="5" fill="#A4C8F0" />
  </svg>
);

// 📄 [디자인] 파일 아이콘
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
  const [bookmarks, setBookmarks] = useState({}); 
  const [progress, setProgress] = useState({});

  const [summaryOpenState, setSummaryOpenState] = useState({});
  const [bookmarkOpenState, setBookmarkOpenState] = useState({});

  const [inputTitle, setInputTitle] = useState(''); 
  const [inputUrl, setInputUrl] = useState(''); 
  const [inputDesc, setInputDesc] = useState('');
  const [activeFileForBookmark, setActiveFileForBookmark] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInput, setModalInput] = useState('');
  const [tempDropInfo, setTempDropInfo] = useState(null); 

  const [sidebarTab, setSidebarTab] = useState('not_added'); 
  
  const [currentMyDocsFolder, setCurrentMyDocsFolder] = useState(null);
  const [currentAddedFolder, setCurrentAddedFolder] = useState(null);
  const [currentNotAddedFolder, setCurrentNotAddedFolder] = useState(null);

  const [addedSortOrder, setAddedSortOrder] = useState('name');
  // 🔴 [복구] 보기 모드 상태
  const [addedViewMode, setAddedViewMode] = useState('folder'); // 'folder' | 'all'

  const [isMyDocsOpen, setIsMyDocsOpen] = useState(false);

  const draggableRef = useRef(null); 
  const myDocsDraggableRef = useRef(null); 
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
    const savedProgress = localStorage.getItem('fileProgress');
    if (savedProgress) setProgress(JSON.parse(savedProgress));

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

    if (myDocsDraggableRef.current) {
        new Draggable(myDocsDraggableRef.current, {
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
  }, [viewMode, sidebarTab, files, events, currentMyDocsFolder, currentAddedFolder, currentNotAddedFolder, addedSortOrder, addedViewMode, isMyDocsOpen]);

  const handleMemoChange = (filePath, text) => {
    const newMemos = { ...memos, [filePath]: text };
    setMemos(newMemos);
    localStorage.setItem('fileMemos', JSON.stringify(newMemos));
  };

  const handleProgressChange = (filePath, value) => {
    const newProgress = { ...progress, [filePath]: value };
    setProgress(newProgress);
    localStorage.setItem('fileProgress', JSON.stringify(newProgress));
  };

  const handleAddBookmark = (filePath) => {
    if (!inputUrl) return alert("URL을 입력해주세요!");
    if (!inputTitle) return alert("제목을 입력해주세요!");
    
    const newBookmark = { title: inputTitle, url: inputUrl, desc: inputDesc };
    const currentList = bookmarks[filePath] || [];
    const newList = [...currentList, newBookmark];

    const newBookmarksMap = { ...bookmarks, [filePath]: newList };
    setBookmarks(newBookmarksMap);
    localStorage.setItem('fileBookmarks', JSON.stringify(newBookmarksMap));
    setInputTitle(''); setInputUrl(''); setInputDesc('');
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

    if (!safePath) return;

    setTempDropInfo({ path: safePath, folder: safeFolder, fileName: safeFileName, date: dropDate });
    setModalInput(''); 
    setIsModalOpen(true);
  };

  const confirmDrop = () => {
    if (!tempDropInfo || !modalInput.trim()) {
        if (!modalInput.trim()) return alert("폴더 이름을 입력해주세요!"); 
        setIsModalOpen(false);
        return;
    }

    const targetFolderName = modalInput.trim();
    const { path, fileName, folder, date } = tempDropInfo;
    const newFile = { path, fileName, folder }; 

    setEvents(prevEvents => {
      const existingIndex = prevEvents.findIndex(evt => evt.date === date && evt.title === targetFolderName);
      if (existingIndex !== -1) {
        const newEvents = [...prevEvents];
        const existingEvent = newEvents[existingIndex];
        const existingFiles = existingEvent.extendedProps.files || [];
        if (!existingFiles.some(f => f.path === path)) {
          newEvents[existingIndex] = {
            ...existingEvent,
            extendedProps: { ...existingEvent.extendedProps, files: [...existingFiles, newFile] }
          };
        }
        return newEvents;
      } else {
        return [...prevEvents, {
          id: Date.now().toString() + Math.random(),
          title: targetFolderName,
          date: date,
          extendedProps: { files: [newFile] },
          backgroundColor: 'transparent',
          borderColor: 'transparent'
        }];
      }
    });

    setFiles(prev => prev.filter(f => f.path !== path));
    setIsModalOpen(false);
    setTempDropInfo(null);
    setModalInput('');
  };

  const cancelDrop = () => {
    setIsModalOpen(false);
    setTempDropInfo(null);
    setModalInput('');
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

  const getAllFiles = () => {
    const allFiles = [...files]; 
    events.forEach(evt => {
        if (evt.extendedProps.files) {
            evt.extendedProps.files.forEach(f => {
                allFiles.push({ ...f, date: evt.date });
            });
        }
    });
    return allFiles;
  };

  const getSidebarContent = () => {
    if (sidebarTab === 'added') {
      const grouped = {};
      events.forEach(evt => {
        const subject = evt.title; 
        if (!grouped[subject]) grouped[subject] = [];
        if (evt.extendedProps.files) {
            evt.extendedProps.files.forEach(f => {
                if (!grouped[subject].some(existing => existing.path === f.path)) {
                    grouped[subject].push({ ...f, date: evt.date, folder: subject });
                }
            });
        }
      });
      return grouped;
    }
    else {
      return files; 
    }
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

  const tabStyle = (tabName) => ({
    flex: 1, padding: '10px 0', cursor: 'pointer', textAlign: 'center', fontSize: '13px', fontWeight: 'bold',
    backgroundColor: sidebarTab === tabName ? '#fff' : '#f1f1f1',
    color: sidebarTab === tabName ? '#007bff' : '#888',
    borderBottom: sidebarTab === tabName ? '2px solid #007bff' : '1px solid #ddd',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none'
  });

  const sidebarData = getSidebarContent();

  // [전체 파일(내 문서함) 렌더링 - 우측 서랍]
  const renderMyDocsTab = () => {
    const allFiles = getAllFiles();

    if (currentMyDocsFolder === null) {
        const folderNames = [...new Set(allFiles.map(f => f.folder))].sort();
        return (
            <div>
                 <div style={{fontSize:'12px', color:'#999', marginBottom:'10px', textAlign:'center'}}>폴더를 선택하여 파일을 확인하세요.</div>
                 {folderNames.map((folderName, idx) => (
                     <div 
                        key={idx}
                        onClick={() => setCurrentMyDocsFolder(folderName)}
                        style={{ display: 'flex', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', backgroundColor: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                     >
                        <div style={{ width: '24px', height: '24px', marginRight: '10px' }}><MacFolderIcon /></div>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{folderName}</span>
                        <span style={{ fontSize: '12px', color: '#aaa', marginLeft: 'auto' }}>
                            {allFiles.filter(f => f.folder === folderName).length}
                        </span>
                     </div>
                 ))}
                 {folderNames.length === 0 && <p style={{color:'#999', textAlign:'center'}}>폴더가 없습니다.</p>}
            </div>
        );
    } else {
        const filesInFolder = allFiles.filter(f => f.folder === currentMyDocsFolder);
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', paddingBottom:'10px', borderBottom:'1px solid #eee' }}>
                    <button onClick={() => setCurrentMyDocsFolder(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#007bff', display:'flex', alignItems:'center' }}>
                        ⬅ 뒤로가기
                    </button>
                    <span style={{ marginLeft: '10px', color: '#ddd' }}>|</span>
                    <span style={{ marginLeft: '10px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>📂 {currentMyDocsFolder}</span>
                </div>
                {filesInFolder.map((file, index) => (
                    <div
                        key={index}
                        className="draggable-item"
                        data-path={file.path}
                        data-folder={file.folder}
                        data-filename={file.title || file.fileName}
                        style={{ margin: '8px 0', padding: '10px', backgroundColor: 'white', border: '1px solid #e0e0e0', cursor: 'grab', borderRadius: '6px', display:'flex', alignItems:'center' }}
                    >
                         <div style={{display:'flex', flexDirection:'column', width:'100%'}}>
                            <div style={{display:'flex', alignItems:'center'}}>
                                <FileIcon />
                                <span style={{ marginLeft: '8px', fontSize:'13px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file.title || file.fileName}
                                </span>
                            </div>
                            {file.date && (
                                <div style={{fontSize:'11px', color:'#e67e22', marginTop:'4px', marginLeft:'32px'}}>
                                    📅 {file.date}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {filesInFolder.length === 0 && <p style={{color:'#999', textAlign:'center'}}>이 폴더는 비어있습니다.</p>}
            </div>
        );
    }
  };

  // [메인 사이드바 렌더링]
  const renderSidebarList = () => {
    
    // A. 미분류 (not_added)
    if (sidebarTab === 'not_added') {
      if (currentNotAddedFolder === null) {
          if (!Array.isArray(sidebarData) || sidebarData.length === 0) {
            return <p style={{color:'#999', fontSize:'12px', textAlign:'center', marginTop:'30px'}}>파일이 없습니다.</p>;
          }
          const folderNames = [...new Set(sidebarData.map(f => f.folder))].sort();
          
          return (
            <div>
                 <div style={{fontSize:'12px', color:'#999', marginBottom:'10px', textAlign:'center'}}>폴더를 선택하여 파일을 확인하세요.</div>
                 {folderNames.map((folderName, idx) => (
                     <div 
                        key={idx}
                        onClick={() => setCurrentNotAddedFolder(folderName)}
                        style={{ display: 'flex', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', backgroundColor: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                     >
                        <div style={{ width: '24px', height: '24px', marginRight: '10px' }}><MacFolderIcon /></div>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{folderName}</span>
                        <span style={{ fontSize: '12px', color: '#aaa', marginLeft: 'auto' }}>
                            {sidebarData.filter(f => f.folder === folderName).length}
                        </span>
                     </div>
                 ))}
            </div>
          );
      } 
      else {
          const filesInFolder = sidebarData.filter(f => f.folder === currentNotAddedFolder);
          return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', paddingBottom:'10px', borderBottom:'1px solid #eee' }}>
                    <button onClick={() => setCurrentNotAddedFolder(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#007bff', display:'flex', alignItems:'center' }}>
                        ⬅ 뒤로가기
                    </button>
                    <span style={{ marginLeft: '10px', color: '#ddd' }}>|</span>
                    <span style={{ marginLeft: '10px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>📂 {currentNotAddedFolder}</span>
                </div>
                {filesInFolder.map((file, index) => (
                    <div
                        key={index}
                        className="draggable-item"
                        data-path={file.path}
                        data-folder={file.folder}
                        data-filename={file.title || file.fileName}
                        style={{ margin: '8px 0', padding: '10px', backgroundColor: 'white', border: '1px solid #e0e0e0', cursor: 'grab', borderRadius: '6px', display:'flex', alignItems:'center' }}
                    >
                         <div style={{pointerEvents: 'none', display:'flex', alignItems:'center', width:'100%'}}>
                            <div style={{width:'24px', height:'24px', marginRight:'8px', flexShrink:0}}><FileIcon /></div>
                            <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                <span style={{fontSize:'13px'}}>{file.title}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {filesInFolder.length === 0 && <p style={{color:'#999', textAlign:'center'}}>이 폴더는 비어있습니다.</p>}
            </div>
          );
      }
    }

    // 🔴 [복구됨] B. 과목별 (added) - 두 가지 모드(폴더/전체) 지원
    if (sidebarTab === 'added') {
        // 토글 버튼 UI
        const toggleHeader = (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button onClick={() => setAddedViewMode('folder')} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: addedViewMode === 'folder' ? '1px solid #007bff' : '1px solid #ddd', backgroundColor: addedViewMode === 'folder' ? '#e7f1ff' : 'white', color: addedViewMode === 'folder' ? '#007bff' : '#555', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>📁 과목별 보기</button>
                <button onClick={() => setAddedViewMode('all')} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: addedViewMode === 'all' ? '1px solid #007bff' : '1px solid #ddd', backgroundColor: addedViewMode === 'all' ? '#e7f1ff' : 'white', color: addedViewMode === 'all' ? '#007bff' : '#555', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>📅 전체 임박순</button>
            </div>
        );

        // 1) 폴더별 보기 (기존 로직)
        if (addedViewMode === 'folder') {
            const keys = Object.keys(sidebarData);
            
            if (currentAddedFolder === null) {
                return (
                    <div>
                        {toggleHeader}
                        <div style={{fontSize:'12px', color:'#999', marginBottom:'10px', textAlign:'center'}}>과목을 선택하여 파일을 확인하세요.</div>
                        {keys.length === 0 && <p style={{color:'#999', fontSize:'12px', textAlign:'center', marginTop:'30px'}}>추가된 파일이 없습니다.</p>}
                        {keys.map((groupName, idx) => (
                            <div key={idx} onClick={() => setCurrentAddedFolder(groupName)} style={{ display: 'flex', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', backgroundColor: 'white', borderRadius: '8px', marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                                <div style={{ width: '24px', height: '24px', marginRight: '10px' }}><MacFolderIcon /></div>
                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{groupName}</span>
                                <span style={{ fontSize: '12px', color: '#aaa', marginLeft: 'auto' }}>{sidebarData[groupName].length}</span>
                            </div>
                        ))}
                    </div>
                );
            } else {
                let filesInSubject = [...(sidebarData[currentAddedFolder] || [])]; 
                if (addedSortOrder === 'name') filesInSubject.sort((a, b) => (a.title || a.fileName).localeCompare(b.title || b.fileName));
                else if (addedSortOrder === 'date') filesInSubject.sort((a, b) => { if(!a.date) return 1; if(!b.date) return -1; return new Date(a.date) - new Date(b.date); });

                return (
                    <div>
                        {toggleHeader}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', paddingBottom:'10px', borderBottom:'1px solid #eee' }}>
                            <button onClick={() => setCurrentAddedFolder(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#007bff', display:'flex', alignItems:'center' }}>⬅ 뒤로가기</button>
                            <span style={{ marginLeft: '10px', color: '#ddd' }}>|</span>
                            <span style={{ marginLeft: '10px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>📚 {currentAddedFolder}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'10px'}}>
                            <select value={addedSortOrder} onChange={(e) => setAddedSortOrder(e.target.value)} style={{padding:'4px', borderRadius:'4px', border:'1px solid #ddd', fontSize:'12px', cursor:'pointer'}}>
                                <option value="name">가나다순</option>
                                <option value="date">마감임박순</option>
                            </select>
                        </div>
                        {filesInSubject.map((file, fIdx) => (
                            <div key={fIdx} className="draggable-item" data-path={file.path} data-folder={file.folder} data-filename={file.title || file.fileName} style={{ margin: '8px 0', padding: '10px', backgroundColor: 'white', border: '1px solid #e0e0e0', cursor: 'grab', borderRadius: '6px', display:'flex', alignItems:'center', fontSize: '13px' }}>
                                <div style={{display:'flex', flexDirection:'column', width:'100%'}}>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                        <div style={{flexShrink:0, marginRight:'8px'}}><FileIcon /></div>
                                        <span style={{ color: '#333', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.title || file.fileName}</span>
                                    </div>
                                    {file.date && <div style={{fontSize:'11px', color:'#e67e22', marginTop:'4px', marginLeft:'32px'}}>📅 {file.date} 마감</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            }
        }
        // 2) 전체 파일 보기 (마감임박순 강제 정렬)
        else {
            let allAddedFiles = [];
            Object.keys(sidebarData).forEach(key => { allAddedFiles = [...allAddedFiles, ...sidebarData[key]]; });
            allAddedFiles.sort((a, b) => { if(!a.date) return 1; if(!b.date) return -1; return new Date(a.date) - new Date(b.date); });

            return (
                <div>
                    {toggleHeader}
                    {allAddedFiles.length === 0 && <p style={{color:'#999', fontSize:'12px', textAlign:'center'}}>파일이 없습니다.</p>}
                    {allAddedFiles.map((file, fIdx) => (
                        <div key={fIdx} className="draggable-item" data-path={file.path} data-folder={file.folder} data-filename={file.title || file.fileName} style={{ margin: '8px 0', padding: '10px', backgroundColor: 'white', border: '1px solid #e0e0e0', cursor: 'grab', borderRadius: '6px', display:'flex', alignItems:'center', fontSize: '13px' }}>
                            <div style={{display:'flex', flexDirection:'column', width:'100%'}}>
                                <div style={{display:'flex', alignItems:'center'}}>
                                    <span style={{fontWeight:'bold', color:'#007bff', fontSize:'11px', marginRight:'6px', whiteSpace: 'nowrap'}}>[{file.folder}]</span>
                                    <div style={{flexShrink:0, marginRight:'4px'}}><FileIcon /></div>
                                    <span style={{ color: '#333', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.title || file.fileName}</span>
                                </div>
                                {file.date && <div style={{fontSize:'11px', color:'#e67e22', marginTop:'4px', marginLeft:'4px'}}>📅 {file.date} 마감</div>}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* 모달 */}
      {isModalOpen && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px 30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', textAlign: 'center' }}>📂 폴더 이름 입력</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#666', textAlign: 'center' }}>캘린더에 표시될 과목명을 입력하세요.</p>
            <input type="text" value={modalInput} placeholder="예: 데이터베이스, 알고리즘..." onChange={(e) => setModalInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') confirmDrop(); }} autoFocus style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={cancelDrop} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>취소</button>
              <button onClick={confirmDrop} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#007bff', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 왼쪽 메인 화면 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {viewMode === 'calendar' && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
              <h2 style={{margin: 0}}>📅 나의 스케줄</h2>
              <button onClick={() => calendarRef.current.getApi().changeView('dayGridMonth')} style={{padding: '8px 12px', cursor: 'pointer', background:'#333', color:'white', border:'none', borderRadius:'6px'}}>전체 보기 (Month)</button>
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
              <button onClick={() => setViewMode('calendar')} style={{ marginRight: '20px', padding: '8px 16px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' }}>← 뒤로가기</button>
              <div style={{ width: '32px', height: '32px', marginRight: '10px' }}><MacFolderIcon /></div>
              <h1 style={{ margin: 0, fontSize: '22px' }}>{openedFolder.title}</h1>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '10px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', minHeight: '100%' }}>
                {openedFolder.files.map((file, idx) => {
                  const isSummaryOpen = summaryOpenState[file.path];
                  const isBookmarkOpen = bookmarkOpenState[file.path];
                  const fileBookmarks = bookmarks[file.path] || [];
                  const currentProgress = progress[file.path] || 0; 
                  return (
                    <div key={idx} onClick={() => window.api.openFile(file.path)} style={{ display: 'flex', flexDirection: 'column', padding: '15px 10px', borderBottom: '1px solid #eee', cursor: 'pointer', transition: '0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '6px' }}>
                        <FileIcon />
                        <span style={{ marginLeft: '12px', fontSize: '16px', fontWeight: 'bold', color: '#333', flex: 1 }}>{file.fileName}</span>
                        <div style={{ width: '300px', display: 'flex', alignItems: 'center', marginLeft:'20px' }}>
                          <span style={{ fontSize: '12px', color: '#999', marginRight: '8px' }}>📝 Memo:</span>
                          <input type="text" placeholder="나만의 메모..." value={memos[file.path] || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => handleMemoChange(file.path, e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', backgroundColor: '#fff8dc' }} />
                        </div>
                      </div>
                      <div style={{ paddingLeft: '38px', marginBottom: '10px', display:'flex', alignItems:'center' }} onClick={(e) => e.stopPropagation()}>
                        <span style={{fontSize:'12px', color:'#666', marginRight:'10px', width:'40px'}}>진행률</span>
                        <input type="range" min="0" max="100" value={currentProgress} onChange={(e) => handleProgressChange(file.path, e.target.value)} style={{ flex: 1, cursor: 'pointer', height: '6px', borderRadius: '3px', appearance: 'none', background: `linear-gradient(to right, #007bff ${currentProgress}%, #e9ecef ${currentProgress}%)` }} />
                        <span style={{fontSize:'12px', color:'#007bff', fontWeight:'bold', marginLeft:'10px', width:'35px', textAlign:'right'}}>{currentProgress}%</span>
                      </div>
                      <div style={{ paddingLeft: '38px', marginBottom: '4px', display:'flex', gap:'15px' }}>
                        <button onClick={(e) => toggleSummary(file.path, e)} style={{ padding: '2px 0px', fontSize: '12px', cursor: 'pointer', border: 'none', background: 'none', color: '#555', fontWeight: '500' }}>{isSummaryOpen ? '📄 요약 접기 🔼' : '📄 요약 보기 🔽'}</button>
                        <button onClick={(e) => toggleBookmark(file.path, e)} style={{ padding: '2px 0px', fontSize: '12px', cursor: 'pointer', border: 'none', background: 'none', color: '#007bff', fontWeight: '500' }}>{isBookmarkOpen ? '🔗 북마크 접기 🔼' : `🔗 북마크 관리 (${fileBookmarks.length}) 🔽`}</button>
                      </div>
                      {isSummaryOpen && (<div style={{ marginLeft: '38px', marginRight: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', fontSize: '13px', color: '#555', lineHeight: '1.6', borderLeft: '4px solid #7AA1D2', marginTop: '5px' }} onClick={(e) => e.stopPropagation()}><div style={{fontWeight: 'bold', marginBottom: '8px', color: '#7AA1D2'}}>💡 AI 자동 요약</div>{summaries[file.path] ? summaries[file.path] : "⏳ 문서 내용을 분석하고 있습니다..."}</div>)}
                      {isBookmarkOpen && (
                        <div style={{ marginLeft: '38px', marginRight: '20px', padding: '15px', backgroundColor: '#eef5ff', borderRadius: '6px', fontSize: '13px', color: '#333', lineHeight: '1.6', borderLeft: '4px solid #007bff', marginTop: '5px' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{fontWeight: 'bold', marginBottom: '10px', color: '#007bff'}}>🔗 관련 링크</div>
                          <ul style={{listStyle:'none', padding:0, margin:'0 0 15px 0'}}>{fileBookmarks.map((bm, i) => (<li key={i} style={{marginBottom:'8px', display:'flex', alignItems:'center', background:'white', padding:'8px', borderRadius:'4px', border:'1px solid #dee2e6'}}><div style={{flex:1, display:'flex', flexDirection:'column', cursor:'pointer'}} onClick={() => openLink(bm.url)}><span style={{fontWeight:'bold', color:'#0056b3', fontSize:'14px'}}>{bm.title}</span><span style={{fontSize:'11px', color:'#999'}}>{bm.url}</span>{bm.desc && <span style={{fontSize:'12px', color:'#555', marginTop:'2px'}}>└ {bm.desc}</span>}</div><button onClick={() => handleDeleteBookmark(file.path, i)} style={{marginLeft:'10px', border:'none', background:'none', cursor:'pointer', color:'#ff4d4f'}}>✖</button></li>))}{fileBookmarks.length === 0 && <li style={{color:'#999', fontSize:'12px'}}>저장된 링크가 없습니다.</li>}</ul><div style={{display:'flex', flexDirection:'column', gap:'8px', background:'white', padding:'10px', borderRadius:'4px', border:'1px solid #ddd'}}><div style={{display:'flex', gap:'8px'}}><input type="text" placeholder="제목" value={activeFileForBookmark === file.path ? inputTitle : ''} onChange={(e) => { setActiveFileForBookmark(file.path); setInputTitle(e.target.value); }} style={{flex:1, padding:'6px', borderRadius:'4px', border:'1px solid #ccc'}} /><input type="text" placeholder="URL" value={activeFileForBookmark === file.path ? inputUrl : ''} onChange={(e) => { setActiveFileForBookmark(file.path); setInputUrl(e.target.value); }} style={{flex:2, padding:'6px', borderRadius:'4px', border:'1px solid #ccc'}} /></div><div style={{display:'flex', gap:'8px'}}><input type="text" placeholder="설명" value={activeFileForBookmark === file.path ? inputDesc : ''} onChange={(e) => { setActiveFileForBookmark(file.path); setInputDesc(e.target.value); }} style={{flex:1, padding:'6px', borderRadius:'4px', border:'1px solid #ccc'}} /><button onClick={() => handleAddBookmark(file.path)} style={{padding:'6px 20px', background:'#007bff', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>추가</button></div></div></div>)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 중간 사이드바 (미분류 / 과목별) */}
      <div style={{ width: '400px', minWidth: '400px', maxWidth: '400px', borderLeft: '1px solid #eee', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* 전체 파일 열기 토글 버튼 */}
        <div style={{padding:'10px', backgroundColor:'white', borderBottom:'1px solid #eee', textAlign:'right'}}>
            <button onClick={() => setIsMyDocsOpen(!isMyDocsOpen)} style={{cursor:'pointer', border:'none', background:'none', fontSize:'14px', fontWeight:'bold', color:'#007bff'}}>
                {isMyDocsOpen ? "👉 전체 보관함 닫기" : "👈 전체 보관함 열기"} 🗄️
            </button>
        </div>

        <div style={{ display: 'flex', backgroundColor: 'white', borderBottom: '1px solid #ddd' }}>
          <button onClick={() => setSidebarTab('not_added')} style={tabStyle('not_added')}>미분류</button>
          <button onClick={() => setSidebarTab('added')} style={tabStyle('added')}>과목별</button>
        </div>

        <div style={{ padding: '15px 20px 5px 20px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
          {sidebarTab === 'not_added' && "📂 캘린더 미추가 파일"}
          {sidebarTab === 'added' && "📚 과목별 분류 (캘린더 추가됨)"}
        </div>

        <div ref={draggableRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
          {renderSidebarList()}
        </div>
      </div>

      {/* 우측 서랍: 전체 파일 보관함 */}
      {isMyDocsOpen && (
        <div style={{ width: '350px', minWidth: '350px', maxWidth: '350px', borderLeft: '1px solid #ccc', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow:'-2px 0 5px rgba(0,0,0,0.05)', zIndex: 900 }}>
            <div style={{ padding: '15px', backgroundColor:'#f8f9fa', borderBottom: '1px solid #eee', fontSize: '15px', fontWeight: 'bold', color: '#333', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>🗄️ 내 문서함 (전체)</span>
                <button onClick={() => setIsMyDocsOpen(false)} style={{border:'none', background:'none', cursor:'pointer', fontSize:'16px'}}>✖</button>
            </div>
            <div ref={myDocsDraggableRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
                {renderMyDocsTab()}
            </div>
        </div>
      )}

    </div>
  );
}

export default App;