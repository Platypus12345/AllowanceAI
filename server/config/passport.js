const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prisma');
const { getGoogleCallbackUrl } = require('./appUrls');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_google_client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_google_client_secret',
      callbackURL: getGoogleCallbackUrl(),
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (!user) {
          user = await prisma.user.findUnique({
            where: { email },
          });

          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id },
            });
          } else {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email,
              },
            });
          }
        }
        return done(null, user);
      } catch (err) {
        console.error('GoogleStrategy user lookup/create failed:', err.message);
        return done(err, null);
      }
    }
  )
);
