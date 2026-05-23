const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { getGoogleCallbackUrl } = require('./appUrls');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getGoogleCallbackUrl(),
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value.toLowerCase();
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            if (!user.picture && profile.photos?.[0]?.value) {
              user.picture = profile.photos[0].value;
            }
            await user.save();
          } else {
            user = await User.create({
              googleId: profile.id,
              email,
              name: profile.displayName,
              picture: profile.photos?.[0]?.value,
              xp: 0,
              level: 1,
              levelTitle: 'Broke Freshman',
            });
          }
        }
        return done(null, user);
      } catch (err) {
        console.error('GoogleStrategy user lookup/create failed:', err.message);
        if (err.message?.includes('namespace')) {
          console.error(
            'Check MONGO_URI on Render — database path must be only /allowanceAI with no extra segments like /.users'
          );
        }
        return done(err, null);
      }
    }
  )
);
