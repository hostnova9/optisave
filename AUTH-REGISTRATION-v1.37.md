# OptiSave v1.37 — Registration Activation & Transaction PIN

- Registration now creates a 4-digit transaction PIN and stores only a bcrypt hash.
- Registration OTP is entered on the registration page; users are no longer redirected to Login after requesting the code.
- Verification messaging tells users to check Spam/Junk when the OTP is not in Inbox.
- Resend cooldown remains 60 seconds without blocking entry of an already-delivered code.
- Successful registration verification creates the authenticated session immediately and redirects to Dashboard.
- Email verification records the activation login event and last-login timestamps.
