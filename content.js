// content.js (최종 완성본 - 모든 버그 해결 및 최종 개선)

// ✨ [추가] 라이브 상태를 저장할 전역 변수
let liveStreamerIds = new Set();
let liveUpdateTimer = null;
let isDraggingModal = false;
let initialX, initialY, xOffset = 0, yOffset = 0;
let modalContainer = null;

// ✨ [수정] 모달 드래그 기능
function dragStart(e) {
    // 드래그를 시작하고 싶지 않은 요소들의 선택자를 정의합니다.
    const noDragSelectors = [
        '#close-modal-btn',
        '#add-group-btn',
        '#new-group-name',
        '.chzzk-grouper-button',
        '.edit-managed-group-btn',
        '.delete-managed-group-btn',
        '.chzzk-grouper-streamer-item', // 모달 안의 스트리머 아이템 드래그 방지
        'input',
        'button',
        'a', // 링크 태그를 추가하여 클릭을 방해하지 않도록 합니다.
    ];

    // 클릭된 요소나 그 부모 요소가 드래그를 원하지 않는 요소에 포함되는지 확인합니다.
    for (const selector of noDragSelectors) {
        if (e.target.closest(selector)) {
            console.log('[디버그] 드래그 금지 요소 클릭 감지. 드래그를 시작하지 않습니다.');
            return;
        }
    }

    // 모달 컨테이너를 찾습니다.
    modalContainer = document.getElementById('chzzk-grouper-modal-container');
    if (!modalContainer) return;

    e.preventDefault();
    const modalRect = modalContainer.getBoundingClientRect();
    initialX = e.clientX - modalRect.left;
    initialY = e.clientY - modalRect.top;
    isDraggingModal = true;
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
}


function dragEnd() {
    console.log('[디버그] dragEnd 함수 호출'); // 디버그 로그 추가
    isDraggingModal = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
}

function drag(e) {
    if (isDraggingModal && modalContainer) {
        e.preventDefault();

        // 뷰포트 크기 가져오기
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 모달의 크기 가져오기
        const modalRect = modalContainer.getBoundingClientRect();
        const modalWidth = modalRect.width;
        const modalHeight = modalRect.height;

        // 마우스 위치 기반으로 새로운 좌표 계산
        let newX = e.clientX - initialX;
        let newY = e.clientY - initialY;

        // 모달이 뷰포트를 벗어나지 않도록 경계값 설정
        // 왼쪽 경계 (0보다 작아지지 않게)
        if (newX < 0) {
            newX = 0;
        }
        // 오른쪽 경계 (뷰포트 너비 - 모달 너비보다 커지지 않게)
        if (newX + modalWidth > viewportWidth) {
            newX = viewportWidth - modalWidth;
        }
        // 위쪽 경계 (0보다 작아지지 않게)
        if (newY < 0) {
            newY = 0;
        }
        // 아래쪽 경계 (뷰포트 높이 - 모달 높이보다 커지지 않게)
        if (newY + modalHeight > viewportHeight) {
            newY = viewportHeight - modalHeight;
        }

        // 새로운 위치를 모달에 적용
        modalContainer.style.setProperty('left', `${newX}px`, 'important');
        modalContainer.style.setProperty('top', `${newY}px`, 'important');
        modalContainer.style.setProperty('transform', `none`, 'important');
    }
}

// ✨ [최종 수정] 라이브 상태를 나타내는 클래스를 가진 부모 요소를 찾아 ID를 파싱
function parseLiveStreamers() {
    liveStreamerIds.clear();
    const allStreamerElements = document.querySelectorAll('.navigator_item__qXlq9');

    allStreamerElements.forEach(element => {
        const isLiveIndicator = element.querySelector('.navigator_is_live__jJiBO');
        if (isLiveIndicator) {
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
    liveUpdateTimer = setInterval(() => {
        parseLiveStreamers();
        renderGroups();
    }, 10000);
}

// content.js 파일에서 getMenuElement 함수를 아래 코드로 교체하세요.

function getMenuElement(menuName) {
    const allMenuWrappers = document.querySelectorAll('div.navigator_wrapper__ruh6f, div.header_service__DyG7M');
    for (const wrapper of allMenuWrappers) {
        // 그룹 컨테이너는 제외합니다.
        if (wrapper.id === 'chzzk-grouper-container') {
            continue;
        }

        // wrapper 내부의 모든 텍스트 요소를 찾습니다.
        const textElements = wrapper.querySelectorAll('h2, span, a');
        for (const element of textElements) {
            // 미묘한 공백을 제거하고 메뉴 이름이 포함되어 있는지 확인합니다.
            if (element.textContent.trim().includes(menuName)) {
                return wrapper; // 메뉴 이름을 포함하는 최상위 래퍼를 반환합니다.
            }
        }
    }
    return null;
}


// ✨ [수정] 메뉴 설정을 적용하는 함수
function applyMenuSettings() {
    chrome.storage.local.get('hiddenMenus', (data) => {
        if (chrome.runtime.lastError) return;
        const hiddenMenus = data.hiddenMenus || [];
        const menuNames = ['추천 채널', '파트너 스트리머', '서비스 바로가기'];

        menuNames.forEach(menuName => {
            const element = getMenuElement(menuName);
            if (element) {
                console.log(`[디버그] '${menuName}' 메뉴를 찾았습니다. `);
                // ✨ [수정] display 속성에 !important를 강제 적용하여 CSS 우선순위 문제를 해결합니다.
                element.style.setProperty('display', hiddenMenus.includes(menuName) ? 'none' : '', 'important');
                console.log(`[디버그] '${menuName}' 메뉴의 display 속성: ${element.style.display}`);
            } else {
                console.log(`[디버그] '${menuName}' 메뉴를 찾을 수 없습니다.`);
            }
        });
    });
}

let draggedStreamer = { id: null, element: null, ghostElement: null };
let draggedGroup = { element: null, id: null, originalY: 0, ghostElement: null };
let draggedStreamerInGroup = { element: null, ghostElement: null, sourceGroupId: null, sourceStreamerId: null, originalY: 0 };

// ✨ [수정] 사이드바와 모달 모두에서 드래그 오버 클래스를 인식하도록 선택자 수정
function handleStreamerInGroupMouseMove(event) {
    if (!draggedStreamerInGroup.ghostElement) return;
    draggedStreamerInGroup.ghostElement.style.transform = `translateY(${event.clientY - draggedStreamerInGroup.originalY}px)`;
    document.querySelectorAll('.chzzk-grouper-streamer-item, .manage-streamer-item').forEach(item => item.classList.remove('drop-indicator'));
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    const dropTarget = elementBelow ? elementBelow.closest('.chzzk-grouper-streamer-item, .manage-streamer-item') : null;
    if (dropTarget) {
        dropTarget.classList.add('drop-indicator');
    }
}

// ✨ [수정] 사이드바와 모달 모두에서 드래그 엔드 로직이 작동하도록 선택자 수정
async function handleStreamerInGroupMouseUp(event) {
    if (!draggedStreamerInGroup.sourceStreamerId) return;

    document.querySelectorAll('.drop-indicator').forEach(item => item.classList.remove('drop-indicator'));
    if(draggedStreamerInGroup.ghostElement) draggedStreamerInGroup.ghostElement.style.display = 'none';
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    if(draggedStreamerInGroup.ghostElement) draggedStreamerInGroup.ghostElement.style.display = '';

    const dropTarget = elementBelow ? elementBelow.closest('.chzzk-grouper-streamer-item, .manage-streamer-item') : null;

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


function handleStreamerMouseMove(event) {
    if (!draggedStreamer.ghostElement) return;
    draggedStreamer.ghostElement.style.left = `${event.clientX + 10}px`;
    draggedStreamer.ghostElement.style.top = `${event.clientY}px`;
    document.querySelectorAll('.chzzk-grouper-group-container').forEach(groupItem => {
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
    const dropTarget = document.querySelector('.chzzk-grouper-group-container.drag-over');
    if (dropTarget) {
        if (dropTarget && dropTarget.dataset.groupId) {
            const groupId = parseInt(dropTarget.dataset.groupId, 10);
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

function makeElementsDraggable() {
    console.log('[디버그] makeElementsDraggable 함수 호출'); // 디버그 로그 추가
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
    // ✨ [수정] sync -> local
    const data = await chrome.storage.local.get(storageKey);
    return data[storageKey] || [];
}

async function saveGroups(groups) {
    // ✨ [수정] sync -> local
    await chrome.storage.local.set({ [storageKey]: groups });
}

async function addGroup(name) {
    console.log(`[디버그] addGroup 함수 호출: ${name}`); // 디버그 로그 추가
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
        groupListArea.innerHTML = '<p style="font-size:12px; color:#aaa; padding:10px;">아직 그룹이 없습니다. "관리" 버튼을 눌러 만들어 보세요!</p>';
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
                <div class="group-name-wrapper">
                    <span class="group-name-span">${group.name}</span>
                    <div class="chzzk-grouper-tooltip">${group.name}</div>
                </div>
                <div class="group-right-info">
                    <span class="group-streamer-count">(${group.streamers.length})</span>
                </div>
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
                const isLive = liveStreamerIds.has(streamer.id);
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

    }
}

// ✨ [수정] 모달 창에 그룹 목록을 렌더링하는 함수
async function renderManagedGroups() {
    console.log('[디버그] renderManagedGroups 함수 호출'); // 디버그 로그 추가
    const manageGroupList = document.getElementById('manage-group-list');
    const newGroupNameInput = document.getElementById('new-group-name');
    const addGroupBtn = document.getElementById('add-group-btn');

    if (!manageGroupList || !newGroupNameInput || !addGroupBtn) {
        console.error('[디버그] 모달 내 요소를 찾을 수 없습니다. (manage-group-list, new-group-name, add-group-btn)');
        return;
    }

    manageGroupList.innerHTML = '';
    const groups = await getGroups();

    groups.forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'manage-group-container';
        groupContainer.dataset.groupId = group.id;

        const groupHeader = document.createElement('div');
        groupHeader.className = 'manage-group-header';
        // ✨ [수정] 이전 버전의 HTML 구조로 복구
        groupHeader.innerHTML = `
            <span class="manage-group-name-wrapper">
                <span class="manage-group-name">${group.name}</span>
                <span class="manage-group-count">(${group.streamers.length})</span>
            </span>
            <div class="manage-group-buttons">
                <button class="chzzk-grouper-button edit-managed-group-btn">✏️</button>
                <button class="chzzk-grouper-button delete-managed-group-btn">🗑️</button>
            </div>
        `;
        groupContainer.appendChild(groupHeader);

        // ✨ [수정] 스트리머 ID 입력 섹션을 모달 헤더 아래에 추가
        const addStreamerSection = document.createElement('div');
        addStreamerSection.className = 'add-streamer-section-modal';
        addStreamerSection.innerHTML = `
            <input type="text" placeholder="스트리머 ID" class="add-streamer-input" data-group-id="${group.id}">
            <button class="chzzk-grouper-button add-streamer-btn">추가</button>
        `;
        groupContainer.appendChild(addStreamerSection);

        const streamerList = document.createElement('div');
        streamerList.className = 'manage-streamer-list';
        streamerList.id = `manage-streamer-list-${group.id}`;
        if (group.isExpanded) {
            streamerList.classList.add('expanded');
        }

        if (group.streamers.length > 0) {
            group.streamers.forEach(streamer => {
                const streamerItem = document.createElement('div');
                streamerItem.className = 'manage-streamer-item';
                streamerItem.dataset.streamerId = streamer.id; // ✨ [추가] 드래그를 위해 dataset 추가

                // ✨ [수정] 스트리머 아이콘 추가
                streamerItem.innerHTML = `
                    <div class="drag-handle streamer-drag-handle">⋮</div>
                    <a href="https://chzzk.naver.com/live/${streamer.id}" target="_blank" class="manage-streamer-profile-link">
                        <img src="${streamer.profileImageUrl}" class="chzzk-grouper-streamer-profile" alt="${streamer.name} 프로필">
                        <span>${streamer.name}</span>
                    </a>
                    <button class="chzzk-grouper-button delete-streamer-btn" data-streamer-id="${streamer.id}">
                        🗑️
                    </button>
                `;
                streamerList.appendChild(streamerItem);

                // ✨ [추가] 모달 내 스트리머 드래그 이벤트 리스너
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
            streamerList.innerHTML = '<p style="font-size:12px; color:#aaa; padding-left:10px;">그룹에 스트리머가 없습니다.</p>';
        }
        groupContainer.appendChild(streamerList);
        manageGroupList.appendChild(groupContainer);

        // 이벤트 리스너 추가
        groupHeader.addEventListener('click', async (e) => {
            // 버튼 클릭 시 이벤트 전파 방지
            if (e.target.closest('button')) {
                return;
            }
            const list = document.getElementById(`manage-streamer-list-${group.id}`);
            const currentlyExpanded = list.classList.toggle('expanded');
            const groupsData = await getGroups();
            const groupToToggle = groupsData.find(g => g.id === group.id);
            if (groupToToggle) {
                groupToToggle.isExpanded = currentlyExpanded;
                await saveGroups(groupsData);
            }
        });

        groupHeader.querySelector('.edit-managed-group-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // 이벤트 전파 방지
            editGroupName(group.id);
        });

        groupHeader.querySelector('.delete-managed-group-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // 이벤트 전파 방지
            deleteGroup(group.id);
        });

        streamerList.querySelectorAll('.delete-streamer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 전파 방지
                const streamerId = btn.dataset.streamerId;
                removeStreamerFromGroup(group.id, streamerId);
            });
        });

        // ✨ [추가] 스트리머 ID 입력으로 추가하는 기능
        const addStreamerInput = groupContainer.querySelector('.add-streamer-input');
        const addStreamerBtn = groupContainer.querySelector('.add-streamer-btn');

        addStreamerBtn.addEventListener('click', async () => {
            const streamerId = addStreamerInput.value.trim();
            if (streamerId) {
                const groupId = parseInt(addStreamerInput.dataset.groupId, 10);
                await addStreamerToGroup(streamerId, groupId);
                addStreamerInput.value = '';
            }
        });

        addStreamerInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const streamerId = addStreamerInput.value.trim();
                if (streamerId) {
                    const groupId = parseInt(addStreamerInput.dataset.groupId, 10);
                    await addStreamerToGroup(streamerId, groupId);
                    addStreamerInput.value = '';
                }
            }
        });

    });

    // ✨ [추가] 모달의 '새 그룹 추가' 버튼 이벤트 리스너
    addGroupBtn.onclick = () => {
        const groupName = newGroupNameInput.value.trim();
        if (groupName) {
            addGroup(groupName);
            newGroupNameInput.value = '';
        }
    };
}

// ✨ [수정] 그룹 위치를 'order'가 아닌 DOM 조작으로 변경하여 버그 해결
function applyGroupPosition(showOnTop) {
    // ✨ [수정] 부모 컨테이너 선택자를 더 안정적인 nav#navigation으로 변경
    const parentContainer = document.querySelector("nav#navigation");
    if (!parentContainer) return;

    const groupUI = document.getElementById('chzzk-grouper-container');

    // ✨ [수정] '팔로잉 채널' 컨테이너를 텍스트로 찾습니다.
    let followingContainer = null;
    try {
        const allWrappers = parentContainer.querySelectorAll('.navigator_wrapper__ruh6f');
        for (const wrapper of allWrappers) {
            const h2 = wrapper.querySelector('h2');
            if (h2 && h2.textContent.includes('팔로잉 채널')) {
                followingContainer = wrapper;
                break;
            }
        }
    } catch (e) {
        console.error('applyGroupPosition: 팔로잉 컨테이너를 찾는 중 오류 발생:', e);
        return;
    }

    if (groupUI && followingContainer && parentContainer) {
        // ✨ [수정] DOM 구조를 직접 조작하여 순서를 변경
        if (showOnTop) {
            parentContainer.prepend(groupUI);
        } else {
            followingContainer.after(groupUI);
        }
    }

    // 이 방식은 order 속성을 사용하지 않으므로 기존 order를 초기화
    Array.from(parentContainer.children).forEach(child => {
        child.style.order = '';
    });
}

async function initializeUI() {
    console.log('[디버그] initializeUI 함수 호출'); // 디버그 로그 추가

    // ✨ [수정] 초기화 시에도 팔로잉 컨테이너를 텍스트로 찾도록 변경
    let followingContainer = null;
    try {
        const allWrappers = document.querySelectorAll('.navigator_wrapper__ruh6f');
        for (const wrapper of allWrappers) {
            const h2 = wrapper.querySelector('h2');
            if (h2 && h2.textContent.includes('팔로잉 채널')) {
                followingContainer = wrapper;
                break;
            }
        }
    } catch (e) {
        console.error('initializeUI: 팔로잉 컨테이너를 찾는 중 오류 발생:', e);
    }

    if (followingContainer && followingContainer.parentNode) {
        console.log('[디버그] 팔로잉 컨테이너를 찾았습니다.'); // 디버그 로그 추가
        if (document.getElementById('chzzk-grouper-container')) {
            console.log('[디버그] 그룹 UI가 이미 존재합니다. 드래그 기능만 다시 활성화합니다.'); // 디버그 로그 추가
            makeElementsDraggable();
            parseLiveStreamers();
           	startLiveStatusUpdater();
            return;
        }

        const groupContainer = document.createElement('div');
        groupContainer.id = 'chzzk-grouper-container';
        groupContainer.className = 'chzzk-grouper-container';
        groupContainer.innerHTML = `
            <div id="chzzk-grouper-header">
                <span>내 그룹</span>
                <button id="manage-groups-btn" class="chzzk-grouper-button">관리</button>
            </div>
            <div id="group-list-area"></div>
        `;
        followingContainer.after(groupContainer);

        const modalHTML = `
    <div class="chzzk-grouper-modal-container" id="chzzk-grouper-modal-container">
        <div class="chzzk-grouper-modal-header" id="modal-header">
            <h3>그룹 관리</h3>
            <button id="close-modal-btn">X</button>
        </div>
        <div class="chzzk-grouper-modal-body">
            <h4>새 그룹 추가</h4>
            <div class="add-group-section">
                <input type="text" id="new-group-name" placeholder="새로운 그룹 이름">
                <button id="add-group-btn" class="chzzk-grouper-button">추가</button>
            </div>
            <hr>
            <h4>기존 그룹 관리</h4>
            <div id="manage-group-list"></div>
        </div>
        <div class="drag-handle-side drag-handle-left"></div>
        <div class="drag-handle-side drag-handle-right"></div>
        <div class="drag-handle-bottom"></div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', modalHTML);
        console.log('[디버그] 그룹 UI 및 모달 HTML을 페이지에 추가했습니다.'); // 디버그 로그 추가

        const data = await chrome.storage.local.get('groupPositionTop');
        applyGroupPosition(data.groupPositionTop || false);

        // 모달 관련 이벤트 리스너를 한 곳에서 관리
        const modalBtn = document.getElementById('manage-groups-btn');
if (modalBtn) {
    modalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const modal = document.getElementById('chzzk-grouper-modal-container');
        if (modal) {
            modal.style.setProperty('display', 'block', 'important');
            // 여기서는 transform과 위치 속성을 제거하여 드래그 함수가 제어하도록 함
            // modal.style.setProperty('top', '50%', 'important');
            // modal.style.setProperty('left', '50%', 'important');
            // modal.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
            modal.style.setProperty('z-index', '99999', 'important');

            renderManagedGroups();
        } else {
            console.error('[디버그] 오류: 모달 요소를 찾을 수 없습니다.');
        }
    });
}
 else {
            console.error('[디버그] 오류: "관리" 버튼을 찾을 수 없습니다.'); // 디버그 로그 추가
        }

        const closeModalBtn = document.getElementById('close-modal-btn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                const modal = document.getElementById('chzzk-grouper-modal-container');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // 드래그 시작 이벤트 리스너 추가 (중복 방지)
        const modalHeader = document.getElementById('modal-header');
        if (modalHeader) {
            modalHeader.addEventListener('mousedown', dragStart);
        }

        document.getElementById('chzzk-grouper-header').addEventListener('click', () => {
            document.getElementById('group-list-area').classList.toggle('expanded');
        });

	    parseLiveStreamers();
	    startLiveStatusUpdater();
	    await renderGroups();
        makeElementsDraggable();
    } else {
        console.log('[디버그] 팔로잉 컨테이너를 찾을 수 없으므로 UI를 초기화하지 않습니다.'); // 디버그 로그 추가
    }
}

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            console.log('[디버그] DOM 변경 감지. initializeUI를 다시 시도합니다.');
            initializeUI();
            applyMenuSettings(); // ✨ [추가] 메뉴를 다시 숨깁니다.
            break;
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('[디버그] chrome.storage 변경 감지'); // 디버그 로그 추가
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
            // 모달이 열려있다면, 모달의 그룹 목록도 다시 렌더링
            const modal = document.getElementById('chzzk-grouper-modal-container');
            if (modal && modal.style.display === 'block') {
                renderManagedGroups();
            }
        }
    }
});

console.log('[디버그] content.js 스크립트 실행 시작'); // 디버그 로그 추가
initializeUI();
applyMenuSettings();