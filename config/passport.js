const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
require("dotenv").config();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:`https://shoten.sreerag.store/auth/google/callback`
},
async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth callback received for user:', profile.id);
    let user = await User.findOne({ googleId: profile.id });
    if (user) {
      return done(null, user);
    }

    // Check for existing user by email to avoid duplicate email errors
    user = await User.findOne({ email: profile.emails[0].value });
    if (user) {
      // If user exists with this email but no googleId, link the Google account
      user.googleId = profile.id;
      await user.save();
      return done(null, user);
    }

    // Create new user if no existing email or googleId
    user = new User({
      name: profile.displayName,
      email: profile.emails[0].value,
      googleId: profile.id,
    });
    await user.save();
    return done(null, user);
  } catch (error) {
    console.error("Error in GoogleStrategy:", error); // Log the error for debugging
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});

module.exports = passport;