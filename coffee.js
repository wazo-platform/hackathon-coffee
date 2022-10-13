import WDAIntegration from './sdk.js';

let session;
let ws;
const CONFERENCE = '9300';

WDAIntegration.onLoaded = async (inboundSession, theme, locale, extra) => {
  session = inboundSession;
  console.log('coffee - onLoaded', { session, theme, locale, extra });
  WDAIntegration.closeLeftPanel();

  websocketCoffee(session.host);
  updateParticipants();
};

WDAIntegration.onUnLoaded = () => {
  WDAIntegration.openLeftPanel();
};


const websocketCoffee = (url) => {
  ws = new WebSocket(`wss://${url}/hackathon/api/ws`);
  ws.addEventListener('open', (event) => {
    console.log('coffee - websocket connected');
  });
  ws.addEventListener('message', updateParticipants);
}

const getConference = async (url) => {
  const options = {
    method: 'GET',
  }

  return fetch(`https://${url}/hackathon/api/coffee`, options).then(response => response.json());
}

const getParticipants = async (url, token, tenant, conference_id) => {
  const options = {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'X-Auth-Token': token,
      'Wazo-Tenant': tenant
    }
  }

  return fetch(`https://${url}/api/calld/1.0/conferences/${conference_id}/participants`, options)
    .then(response => response.json())
    .then(response => response.items);
}

const updateParticipants = async () => {
  const loading = document.getElementById('loading');
  loading.style.display = 'block';

  let hasParticipants = false;
  let participants = [];

  if (session) {
    const conference = await getConference(session.host);
    const conference_id = conference.id;
    participants = await getParticipants(session.host, session.token, session.tenantUuid, conference_id);
    hasParticipants = !!participants.length;
  }

  loading.style.display = 'none';

  const table = document.getElementById("members");
  table.style.display = hasParticipants ? 'table' : 'none';

  const emptyRoomMessage = document.getElementById('empty-room');
  emptyRoomMessage.style.display = hasParticipants ? 'none' : 'block';

  const callRoom = () => WDAIntegration.startCall({ targets: [CONFERENCE], requestedModalities: ['video'] });
  const goToRoom = () => WDAIntegration.openLink('/video-conference/25');

  const button = document.getElementById('have-a-sip');
  try {
    button.removeEventListener('click', callRoom);
    button.removeEventListener('click', goToRoom);
  } catch (_) { }

  button.addEventListener('click', hasParticipants ? goToRoom : callRoom)
  button.innerHTML = hasParticipants ? 'Go to room' : 'Have a SIP!';

  console.log('coffee - updating participant list', { numParticipants: participants.length });

  if (hasParticipants) {
    while (table.rows.length > 1) {
      table.deleteRow(table.rows.length - 1);
    }

    participants.forEach(participant => {
      const row = table.insertRow(-1);
      const member = row.insertCell(0);
      const time = row.insertCell(1);
      member.innerHTML = participant.caller_id_name;
      time.innerHTML = "01.00";
    });
  }
}

WDAIntegration.initialize();
