import WDAIntegration from './sdk.js';

let session;
let ws;
let timeCheck;
let playing;
const timers = {};
const CONFERENCE = '9300';

WDAIntegration.onLoaded = async (inboundSession, theme, locale, extra) => {
  session = inboundSession;
  console.log('coffee - onLoaded', { session, theme, locale, extra });
  WDAIntegration.closeLeftPanel();

  websocketCoffee(session.host);
  updateParticipants();
  setupMedia();
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

const getParticipants = async (url) => {
  const options = {
    method: 'GET',
    headers: {
      'content-type': 'application/json'
    }
  }

  return fetch(`https://${url}/hackathon/api/participants`, options)
    .then(response => response.json())
    .then(response => response.items);
}

const setupMedia = () => {
  const player = document.querySelector('#media > a');
  const icon = document.querySelector('#media > a > img');

  player.addEventListener('click', async () => {
    try {
      const options = {
        method: 'POST',
      }
      await fetch(`https://${session.host}/hackathon/api/moh/${playing ? 'stop' : 'play'}`, options);
      playing = !playing;
      icon.src = playing ? 'pause.png' : 'play.png';
    } catch (e) {
      console.log(e);
    }
  })
}

const setMediaVisibility = show => {
  const media = document.querySelector('#media');
  media.style.display = show ? 'block' : 'none';
}

const timeFormat = duration => {
  // Hours, minutes and seconds
  var hrs = ~~(duration / 3600);
  var mins = ~~((duration % 3600) / 60);
  var secs = ~~duration % 60;

  // Output like "1:01" or "4:03:59" or "123:03:59"
  var ret = "";

  if (hrs > 0) {
    ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
  }

  ret += "" + mins + ":" + (secs < 10 ? "0" : "");
  ret += "" + secs;
  return ret;
}

const updateTimers = () => {
  const now = Date.now();
  Object.keys(timers).forEach(callId => {
    const time = document.querySelector(`tr#row-${callId.replace('.', '-')} td.time`);
    const date = timers[callId];
    time.innerHTML = `${timeFormat((now - date.getTime()) / 1000)}`;
  })
}

const updateParticipants = async () => {
  const loading = document.getElementById('loading');
  loading.style.display = 'block';

  let hasParticipants = false;

  const conference = await getConference(session.host);
  const conference_id = conference.id;
  const participants = await getParticipants(session.host);
  hasParticipants = !!participants.length;

  loading.style.display = 'none';

  const table = document.getElementById("members");
  table.style.display = hasParticipants ? 'table' : 'none';

  const emptyRoomMessage = document.getElementById('empty-room');
  emptyRoomMessage.style.display = hasParticipants ? 'none' : 'block';

  const callRoom = () => WDAIntegration.startCall({ targets: [CONFERENCE], requestedModalities: ['video'] });
  const goToRoom = () => WDAIntegration.openLink(`/video-conference/${conference_id}`);

  const button = document.getElementById('have-a-sip');

  try {
    button.removeEventListener('click', callRoom);
    button.removeEventListener('click', goToRoom);
  } catch (_) { }

  const userIsInRoom = participants.some(({ caller_id_name: name }) => name === session.profile.firstName);

  button.addEventListener('click', userIsInRoom ? goToRoom : callRoom)
  button.innerHTML = userIsInRoom ? 'Go to room' : 'Have a SIP!';

  console.log('coffee - updating participant list', { numParticipants: participants.length });

  if (hasParticipants) {
    const now = Date.now();

    while (table.rows.length > 1) {
      table.deleteRow(table.rows.length - 1);
    }

    participants.forEach(participant => {
      const { call_id: callId, caller_id_name: name, join_time: joinTime } = participant;
      // let's initiate timers
      if (!timers[callId]) {
        timers[callId] = new Date(now - (+joinTime * 1000));
      }

      const row = table.insertRow(-1);
      row.id = `row-${callId.replace('.', '-')}`;
      const member = row.insertCell(0);
      member.innerHTML = name;
      const time = row.insertCell(1);
      time.className = 'time';
    });


    // let's remove unused timers
    Object.keys(timers).forEach(callId => {
      const participantExists = participants.map(p => p.call_id).includes(callId);
      if (!participantExists) {
        delete timers[callId];
      }
    });

    if (!timeCheck) {
      timeCheck = setInterval(updateTimers, 1000);
      updateTimers();
    }

    setMediaVisibility(true);

    return;
  }

  // at this point, we have no participants

  // let's clear the timers update
  if (timeCheck) {
    clearInterval(timeCheck);
  }

  setMediaVisibility(false);
}

WDAIntegration.initialize();
