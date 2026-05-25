const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function sendPushToUser(user, { title, body, data = {} }) {
  if (!user?.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) {
    return false;
  }
  try {
    const chunks = expo.chunkPushNotifications([
      { to: user.expoPushToken, sound: 'default', title, body, data },
    ]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    return true;
  } catch (err) {
    console.error('Push send failed:', err.message);
    return false;
  }
}

module.exports = { sendPushToUser };
