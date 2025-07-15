// content.js (최종본)

let liveStreamerIds = new Set();
let liveUpdateTimer = null;

// ✨ [최종 수정] 라이브 상태를 나타내는 클래스를 가진 부모 요소를 찾아 ID를 파싱
function parseLiveStreamers() {
    liveStreamerIds.clear();
    // `.navigator_item__qXlq9` 클래스를 가진 모든 스트리머 요소를 찾습니다.
    const allStreamerElements = document.querySelectorAll('.navigator_item__qXlq9');
    
    allStreamerElements.forEach(element => {
        // 각 스트리머 요소 안에서 `.navigator_is_live__jJiBO` 클래스를 가진 자식 요소를 찾습니다.
        const isLiveIndicator = element.querySelector('.navigator_is_live__jJiBO');
        
        // 만약 해당 클래스를 가진 자식 요소가 존재하면,
        if (isLiveIndicator) {
            // 해당 스트리머 요소가 바로 <a> 태그이므로, href 속성에서 ID를 추출합니다.
            if (element.href) {
                const streamerId = element.href.split('/').pop();
                if (streamerId) {
                    liveStreamerIds.add(streamerId);
                }
            }
        }
    });
    console.log('[Chzzk Grouper] 라이브 스트리머 정보 업데이트 완료:', liveStreamerIds);
}

// ✨ [추가] 라이브 상태를 주기적으로 업데이트하는 함수
function startLiveStatusUpdater() {
    if (liveUpdateTimer) {
        clearInterval(liveUpdateTimer);
    }
    // 10초마다 라이브 스트리머 정보 업데이트
    liveUpdateTimer = setInterval(() => {
        parseLiveStreamers();
        renderGroups();
    }, 10000); 
}
const menuSelectors = {
    '추천 채널': 'div.navigator_wrapper__ruh6f:nth-of-type(2)',
    '파트너 스트리머': 'div.navigator_wrapper__ruh6f:nth-of-type(3)',
    '서비스 바로가기': 'div.header_service__DyG7M:nth-of-type(2)'
};

function applyMenuSettings() {
    chrome.storage.local.get('hiddenMenus', (data) => {
        if (chrome.runtime.lastError) return;
        const hiddenMenus = data.hiddenMenus || [];
        for (const menuName in menuSelectors) {
            const element = document.querySelector(menuSelectors[menuName]);
            if (element) {
                element.style.display = hiddenMenus.includes(menuName) ? 'none' : '';
            }
        }
    });
}

let draggedStreamer = { id: null, element: null, ghostElement: null };
let draggedGroup = { element: null, id: null, originalY: 0, ghostElement: null };
let draggedStreamerInGroup = { element: null, ghostElement: null, sourceGroupId: null, sourceStreamerId: null, originalY: 0 };

function handleStreamerMouseMove(event) {
    if (!draggedStreamer.ghostElement) return;
    draggedStreamer.ghostElement.style.left = `${event.clientX + 10}px`;
    draggedStreamer.ghostElement.style.top = `${event.clientY}px`;
    document.querySelectorAll('.chzzk-grouper-group-item').forEach(groupItem => {
        const rect = groupItem.getBoundingClientRect();
        if (event.clientX > rect.left && event.clientX < rect.right &&
            event.clientY > rect.top && event.clientY < rect.bottom) {
            groupItem.classList.add('drag-over');
        } else {
            groupItem.classList.remove('drag-over');
        }
    });
}

async function handleStreamerMouseUp(event) {
    if (!draggedStreamer.id) return;
    const dropTarget = document.querySelector('.chzzk-grouper-group-item.drag-over');
    if (dropTarget) {
        const groupContainer = dropTarget.closest('.chzzk-grouper-group-container');
        if (groupContainer && groupContainer.dataset.groupId) {
            const groupId = parseInt(groupContainer.dataset.groupId, 10);
            await addStreamerToGroup(draggedStreamer.id, groupId);
        }
    }
    document.removeEventListener('mousemove', handleStreamerMouseMove);
    document.removeEventListener('mouseup', handleStreamerMouseUp);
    if (draggedStreamer.ghostElement) {
        draggedStreamer.ghostElement.remove();
    }
    document.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
    document.body.style.cursor = '';
    draggedStreamer = { id: null, element: null, ghostElement: null };
}

function handleGroupMouseMove(event) {
    if (!draggedGroup.ghostElement) return;
    draggedGroup.ghostElement.style.transform = `translateY(${event.clientY - draggedGroup.originalY}px)`;
}

async function handleGroupMouseUp(event) {
    if (!draggedGroup.id) return;

    if(draggedGroup.ghostElement) draggedGroup.ghostElement.style.display = 'none';
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    if(draggedGroup.ghostElement) draggedGroup.ghostElement.style.display = '';

    const dropTarget = elementBelow ? elementBelow.closest('.chzzk-grouper-group-container') : null;

    if (dropTarget && dropTarget.dataset.groupId !== draggedGroup.id) {
        const fromId = parseInt(draggedGroup.id, 10);
        const toId = parseInt(dropTarget.dataset.groupId, 10);
        let groups = await getGroups();
        const fromIndex = groups.findIndex(g => g.id === fromId);
        const toIndex = groups.findIndex(g => g.id === toId);

        if (fromIndex > -1 && toIndex > -1) {
            const [movedGroup] = groups.splice(fromIndex, 1);
            groups.splice(toIndex, 0, movedGroup);
            await saveGroups(groups);       
	 }
    }

    document.removeEventListener('mousemove', handleGroupMouseMove);
    document.removeEventListener('mouseup', handleGroupMouseUp);
    if (draggedGroup.ghostElement) {
        draggedGroup.ghostElement.remove();
    }
    document.body.style.cursor = '';
    draggedGroup = { element: null, id: null, originalY: 0, ghostElement: null };
}

function handleStreamerInGroupMouseMove(event) {
    if (!draggedStreamerInGroup.ghostElement) return;
    draggedStreamerInGroup.ghostElement.style.transform = `translateY(${event.clientY - draggedStreamerInGroup.originalY}px)`;
    document.querySelectorAll('.chzzk-grouper-streamer-item').forEach(item => item.classList.remove('drop-indicator'));
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    const dropTarget = elementBelow ? elementBelow.closest('.chzzk-grouper-streamer-item') : null;
    if (dropTarget) {
        dropTarget.classList.add('drop-indicator');
    }
}

async function handleStreamerInGroupMouseUp(event) {
    if (!draggedStreamerInGroup.sourceStreamerId) return;

    document.querySelectorAll('.drop-indicator').forEach(item => item.classList.remove('drop-indicator'));
    if(draggedStreamerInGroup.ghostElement) draggedStreamerInGroup.ghostElement.style.display = 'none';
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    if(draggedStreamerInGroup.ghostElement) draggedStreamerInGroup.ghostElement.style.display = '';
    
    const dropTarget = elementBelow ? elementBelow.closest('.chzzk-grouper-streamer-item') : null;

    if (dropTarget && dropTarget.dataset.streamerId !== draggedStreamerInGroup.sourceStreamerId) {
        const sourceGroupId = parseInt(draggedStreamerInGroup.sourceGroupId, 10);
        const sourceStreamerId = draggedStreamerInGroup.sourceStreamerId;
        const targetStreamerId = dropTarget.dataset.streamerId;
        
        let groups = await getGroups();
        const group = groups.find(g => g.id === sourceGroupId);
        if (group) {
            const fromIndex = group.streamers.findIndex(s => s.id === sourceStreamerId);
            const toIndex = group.streamers.findIndex(s => s.id === targetStreamerId);

            if (fromIndex > -1 && toIndex > -1) {
                const [movedStreamer] = group.streamers.splice(fromIndex, 1);
                group.streamers.splice(toIndex, 0, movedStreamer);
                await saveGroups(groups);
            }
        }
    }

    document.removeEventListener('mousemove', handleStreamerInGroupMouseMove);
    document.removeEventListener('mouseup', handleStreamerInGroupMouseUp);
    if (draggedStreamerInGroup.ghostElement) {
        draggedStreamerInGroup.ghostElement.remove();
    }
    document.body.style.cursor = '';
    draggedStreamerInGroup = { element: null, ghostElement: null, sourceGroupId: null, sourceStreamerId: null, originalY: 0 };
}

function makeElementsDraggable() {
    const streamerSelector = ".navigator_item__qXlq9";
    const streamerElements = document.querySelectorAll(streamerSelector);
    streamerElements.forEach(element => {
        if (element.dataset.dragListenerAttached) return;
        element.dataset.dragListenerAttached = 'true';
        element.style.cursor = 'grab';
        element.addEventListener('mousedown', (event) => {
            if (event.button !== 0 || !element.href) return;
            event.preventDefault();
            draggedStreamer.id = element.href.split('/').pop();
            draggedStreamer.element = element;
            document.body.style.cursor = 'grabbing';
            const ghost = element.cloneNode(true);
            ghost.style.position = 'fixed';
            ghost.style.zIndex = '10000';
            ghost.style.pointerEvents = 'none';
            ghost.style.opacity = '0.8';
            ghost.style.width = `${element.offsetWidth}px`;
            ghost.style.left = `${event.clientX + 10}px`;
            ghost.style.top = `${event.clientY}px`;
            document.body.appendChild(ghost);
            draggedStreamer.ghostElement = ghost;
            document.addEventListener('mousemove', handleStreamerMouseMove);
            document.addEventListener('mouseup', handleStreamerMouseUp);
        });
    });
}

const storageKey = "chzzk_grouper_groups";

async function getStreamerInfoFromId(streamerId) {
    const url = `https://api.chzzk.naver.com/service/v1/channels/${streamerId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`서버 응답 오류 (상태 코드: ${response.status})`);
        }
        const data = await response.json();
        const channelInfo = data.content || {};
        return {
            id: streamerId,
            name: channelInfo.channelName,
            profileImageUrl: channelInfo.channelImageUrl
        };
    } catch (error) {
        console.error(`스트리머 정보(${streamerId})를 가져오는 중 오류:`, error);
        return null;
    }
}

async function addStreamerToGroup(streamerId, groupId) {
    const groups = await getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.streamers.some(s => s.id === streamerId)) {
        alert("이미 그룹에 추가된 스트리머입니다.");
        return;
    }
    const streamerInfo = await getStreamerInfoFromId(streamerId);
    if (streamerInfo) {
        group.streamers.push(streamerInfo);
        await saveGroups(groups);
        alert(`${streamerInfo.name}님을 '${group.name}' 그룹에 추가했습니다.`);
    }
}

async function removeStreamerFromGroup(groupId, streamerId) {
    let groups = await getGroups();
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const streamerIndex = group.streamers.findIndex(s => s.id === streamerId);
        if (streamerIndex > -1) {
            const streamerName = group.streamers[streamerIndex].name;
            if (confirm(`'${group.name}' 그룹에서 '${streamerName}'님을 정말 삭제하시겠습니까?`)) {
                group.streamers.splice(streamerIndex, 1);
                await saveGroups(groups);
            }
        }
    }
}

async function editGroupName(groupId) {
    let groups = await getGroups();
    const groupToEdit = groups.find(g => g.id === groupId);
    if (groupToEdit) {
        const newName = prompt("새로운 그룹 이름을 입력하세요:", groupToEdit.name);
        const trimmedNewName = newName ? newName.trim() : "";
        if (!trimmedNewName || trimmedNewName === groupToEdit.name) return;
        
        const isDuplicate = groups.some(group => group.id !== groupId && group.name === trimmedNewName);
        if (isDuplicate) {
            alert("이미 같은 이름의 그룹이 존재합니다. 다른 이름을 사용해주세요.");
            return;
        }
        groupToEdit.name = trimmedNewName;
        await saveGroups(groups);
    }
}

async function getGroups() {
    const data = await chrome.storage.local.get(storageKey);
    return data[storageKey] || [];
}

async function saveGroups(groups) {
    await chrome.storage.local.set({ [storageKey]: groups });
}

async function addGroup(name) {
    const groups = await getGroups();
    if (groups.some(group => group.name === name)) {
        alert("이미 같은 이름의 그룹이 존재합니다.");
        return;
    }
    groups.push({ id: Date.now(), name: name, streamers: [], isExpanded: true });
    await saveGroups(groups);
    alert(`'${name}' 그룹이 추가되었습니다.`);
}

async function deleteGroup(id) {
    let groups = await getGroups();
    const groupName = groups.find(g => g.id === id)?.name || '';
    if (confirm(`'${groupName}' 그룹을 정말 삭제하시겠습니까?`)) {
        groups = groups.filter(group => group.id !== id);
        await saveGroups(groups);
    }
}

async function renderGroups() {
    let retryCount = 0;
    while (liveStreamerIds.size === 0 && retryCount < 10) {
        console.log('[Chzzk Grouper] 라이브 스트리머 정보 로딩 중... 잠시 후 재시도합니다.');
        await new Promise(resolve => setTimeout(resolve, 500));
        retryCount++;
    }
    const groupListArea = document.getElementById('group-list-area');
    if (!groupListArea) return;
    
    groupListArea.innerHTML = '';
    const groups = await getGroups();
    
    if (groups.length === 0) {
        groupListArea.innerHTML = '<p style="font-size:12px; color:#aaa; padding:10px;">아직 그룹이 없습니다. "그룹 추가" 버튼을 눌러 만들어 보세요!</p>';
        return;
    }

    for (const group of groups) {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'chzzk-grouper-group-container';
        groupContainer.dataset.groupId = group.id;

        const groupItem = document.createElement('div');
        groupItem.className = 'chzzk-grouper-group-item';
        groupItem.innerHTML = `
            <div class="group-item-row-1">
                <div class="drag-handle group-drag-handle">☰</div>
                <span class="group-name-span">${group.name} (${group.streamers.length})</span>
                <div class="chzzk-grouper-tooltip">${group.name}</div>
            </div>
            <div class="group-item-row-2">
                <button class="chzzk-grouper-button edit-group-btn" title="그룹 이름 수정">수정</button>
                <button class="chzzk-grouper-button add-streamer-btn" data-group-id="${group.id}" title="스트리머 추가">추가</button>
                <button class="chzzk-grouper-button delete-group-btn" title="그룹 삭제">삭제</button>
            </div>
        `;
        groupContainer.appendChild(groupItem);

        const streamerList = document.createElement('div');
        streamerList.className = 'chzzk-grouper-group-list';
        streamerList.id = `group-${group.id}`;
        if (group.isExpanded) {
            streamerList.classList.add('expanded');
        }

        if (group.streamers.length > 0) {
         
            group.streamers.forEach((streamer) => {
                const isLive = liveStreamerIds.has(streamer.id); // 메모리 변수로 라이브 여부 판단
                const streamerItem = document.createElement('div');
                streamerItem.className = 'chzzk-grouper-streamer-item';
                streamerItem.dataset.streamerId = streamer.id;
                
                streamerItem.innerHTML = `
                    <div class="drag-handle streamer-drag-handle">⋮</div>
                    <a href="https://chzzk.naver.com/live/${streamer.id}" target="_blank">
                        <img src="${streamer.profileImageUrl}" class="chzzk-grouper-streamer-profile" alt="${streamer.name} 프로필">
                        <span>${streamer.name}</span>
                        <div class="chzzk-grouper-tooltip">${streamer.name}</div>
                    </a>
                    <div class="live-status-container">
                        ${isLive ? `
                            <div class="live-dot"></div>
                        ` : ''}
                    </div>
                `;
                streamerList.appendChild(streamerItem);
		// ✨ [수정] 우클릭 삭제 기능 추가
               	 streamerItem.addEventListener('contextmenu', (e) => {
                   		 e.preventDefault();
                   	 if (confirm(`'${streamer.name}'님을 그룹에서 삭제하시겠습니까?`)) {
                       	 removeStreamerFromGroup(group.id, streamer.id);
                  	  }
           		     });
                streamerItem.querySelector('.streamer-drag-handle').addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    draggedStreamerInGroup = {
                        element: streamerItem,
                        ghostElement: null,
                        sourceGroupId: group.id,
                        sourceStreamerId: streamer.id,
                        originalY: e.clientY
                    };
                    document.body.style.cursor = 'grabbing';
                    const ghost = streamerItem.cloneNode(true);
                    ghost.style.position = 'fixed';
                    ghost.style.zIndex = '10001';
                    ghost.style.pointerEvents = 'none';
                    ghost.style.opacity = '0.8';
                    ghost.style.backgroundColor = '#333';
                    ghost.style.width = `${streamerItem.offsetWidth}px`;
                    ghost.style.left = `${streamerItem.getBoundingClientRect().left}px`;
                    ghost.style.top = `${streamerItem.getBoundingClientRect().top}px`;
                    document.body.appendChild(ghost);
                    draggedStreamerInGroup.ghostElement = ghost;
                    document.addEventListener('mousemove', handleStreamerInGroupMouseMove);
                    document.addEventListener('mouseup', handleStreamerInGroupMouseUp);
                });
            });
        } else {
            streamerList.innerHTML = '<p style="font-size:12px; color:#aaa; padding-left:10px;">스트리머를 드래그하여 추가하세요.</p>';
        }

        groupContainer.appendChild(streamerList);
        groupListArea.appendChild(groupContainer);

        groupItem.querySelector('.group-drag-handle').addEventListener('mousedown', (e) => {
            e.preventDefault();
            draggedGroup.element = groupContainer;
            draggedGroup.id = groupContainer.dataset.groupId;
            draggedGroup.originalY = e.clientY;
            
            document.body.style.cursor = 'grabbing';
            const ghost = groupContainer.cloneNode(true);
            ghost.style.position = 'fixed';
            ghost.style.zIndex = '10000';
            ghost.style.pointerEvents = 'none';
            ghost.style.opacity = '0.8';
            ghost.style.width = `${groupContainer.offsetWidth}px`;
            ghost.style.left = `${groupContainer.getBoundingClientRect().left}px`;
            ghost.style.top = `${groupContainer.getBoundingClientRect().top}px`;
            document.body.appendChild(ghost);
            draggedGroup.ghostElement = ghost;
            document.addEventListener('mousemove', handleGroupMouseMove);
            document.addEventListener('mouseup', handleGroupMouseUp);
        });

        groupItem.querySelector('.group-name-span').addEventListener('click', async () => {
            const list = document.getElementById(`group-${group.id}`);
            const currentlyExpanded = list.classList.toggle('expanded');
            const groupsData = await getGroups();
            const groupToToggle = groupsData.find(g => g.id === group.id);
            if (groupToToggle) {
                groupToToggle.isExpanded = currentlyExpanded;
                await saveGroups(groupsData);
            }
        });

        groupItem.querySelector('.edit-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            editGroupName(group.id);
        });

        groupItem.querySelector('.delete-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGroup(group.id);
        });
	groupItem.querySelector('.add-streamer-btn').addEventListener('click', (e) => {
    		e.stopPropagation();
    		const streamerId = prompt("추가할 스트리머 ID를 입력하세요:");
    		if (streamerId && streamerId.trim() !== "") {
        			addStreamerToGroup(streamerId.trim(), group.id);
  		  }
	});
    }
}

function applyGroupPosition(showOnTop) {
    const groupUI = document.getElementById('chzzk-grouper-container');
    const followingContainer = document.querySelector(".navigator_wrapper__ruh6f:first-of-type");
    if (groupUI && followingContainer && followingContainer.parentNode) {
        const parentContainer = followingContainer.parentNode;
        parentContainer.style.display = 'flex';
        parentContainer.style.flexDirection = 'column';
        if (showOnTop) {
            groupUI.style.order = '1';
            followingContainer.style.order = '2';
        } else {
            followingContainer.style.order = '1';
            groupUI.style.order = '2';
        }
    }
}

async function initializeUI() {
    const followingContainer = document.querySelector(".navigator_wrapper__ruh6f:first-of-type");
    if (followingContainer && followingContainer.parentNode) {
        if (document.getElementById('chzzk-grouper-container')) {
            makeElementsDraggable();
	    parseLiveStreamers();
           	     startLiveStatusUpdater();
            return;
        }

        const groupContainer = document.createElement('div');
        groupContainer.id = 'chzzk-grouper-container';
        groupContainer.className = 'chzzk-grouper-container';
        groupContainer.innerHTML = `
            <div id="chzzk-grouper-header" class="chzzk-grouper-group-header">
                <span>내 그룹</span>
                <button id="add-group-btn" class="chzzk-grouper-button">그룹 추가</button>
            </div>
            <div id="group-list-area"></div>
        `;
        followingContainer.after(groupContainer);
        
        const data = await chrome.storage.local.get('groupPositionTop');
        applyGroupPosition(data.groupPositionTop || false);

        document.getElementById('add-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const groupName = prompt("새로운 그룹 이름을 입력하세요:");
            if (groupName && groupName.trim() !== "") {
                addGroup(groupName.trim());
            }
        });

        document.getElementById('chzzk-grouper-header').addEventListener('click', () => {
            document.getElementById('group-list-area').classList.toggle('expanded');
        });
        
        
	parseLiveStreamers();
	startLiveStatusUpdater();
	await renderGroups();
        makeElementsDraggable();
    }
}

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            initializeUI();
            applyMenuSettings();
            break;
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    // ✨ [수정] local 저장소의 변경을 감지하여 메뉴 설정을 다시 적용
    if (namespace === 'local') {
        if (changes.hiddenMenus) {
            applyMenuSettings();
        }
        if (changes.groupPositionTop) {
            applyGroupPosition(changes.groupPositionTop.newValue || false);
        }
        if (changes[storageKey]) {
            renderGroups();
        }
    }
});

initializeUI();
applyMenuSettings();
