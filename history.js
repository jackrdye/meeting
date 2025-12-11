// Simple in-memory history storage
const history = {};

function addTranscript(meetingId, transcriptData) {
    if (!history[meetingId]) {
        history[meetingId] = [];
    }
    history[meetingId].push(transcriptData);
}

function getMeetingHistory(meetingId) {
    return history[meetingId] || [];
}

function clearMeetingHistory(meetingId) {
    delete history[meetingId];
}

module.exports = {
    addTranscript,
    getMeetingHistory,
    clearMeetingHistory
};
