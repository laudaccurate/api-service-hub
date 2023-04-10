const mongoose = require("mongoose");
const User = mongoose.model("User");
const uuid = require("uuid");
const multer = require("multer");
const nodemailer = require("nodemailer");
const Handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");

const emailTemplatePath = path.join(
  __dirname,
  "..",
  "templates",
  "confirmation-email.hbs",
);

//
const emailTemplate = fs.readFileSync(emailTemplatePath, "utf8");

const compiledEmailTemplate = Handlebars.compile(emailTemplate);

//Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return Util.error("All fields required", next);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "The email or password you entered is incorrect" });
    }

    const matching = await user.authenticate(password);
    if (!matching) {
      return res
        .status(400)
        .json({ message: "The email or password you entered is incorrect" });
    }

    // req.session.userId = user._id;
    const { password: pass, rest } = user;
    return res.status(200).json(rest);
  } catch (error) {
    return res.status(error.status || 401).json({ message: error.message });
  }
};

//Setting Up Multer MiddleWare
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, cb) {
    cb(null, uuid.v4() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

exports.createUser = async (req, res, next) => {
  console.log("Create user handler");
  try {
    upload.single("image")(req, res, async function (err) {
      if (err) {
        return res.status(400).json({
          error: err.message,
          cMsg: "Error creating user",
        });
      }

      //Assigning file properties
      const file = req.file;
      const baseUrl = `${req.protocol}://${req.headers.host}`;
      const imageUrl = `${baseUrl}/uploads/${file?.filename}`; // get the path of the uploaded image

      const { email, phone } = req.body;

      // Checking if email or phone already exists
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          error: "Email already exists",
          cMsg: "Error creating user",
        });
      }
      //Checking if phone exists
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({
          error: "Phone number already exists",
          cMsg: "Error creating user",
        });
      }

      const userData = req.body;
      const verificationToken = uuid.v4();
      const rememberToken = uuid.v4();
      const user = await User.create({
        ...userData,
        image: file?.filename,
        imageUrl,
        verification_token: verificationToken,
        remember_token: rememberToken,
      });

      //Emailing the user
      console.log("email Sending");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const mailOptions = {
        from: "ServiceHub <dennisagbokpe@gmail.com>",
        to: email, // list of receivers
        subject: "Please Confirm Your Email Address", // Subject line
        html: compiledEmailTemplate({
          firstName: userData.firstName,
          confirmUrl: `${baseUrl}/confirm?token=${user.verification_token}`,
        }), // html body
      };

      await transporter.sendMail(mailOptions);
      console.log("email Sent");

      res.status(200).json(user);
    });
  } catch (error) {
    next(error);
  }
};

//
exports.confirmUserEmail = async (req, res, next) => {
  console.log("Confirming User");
  try {
    const { token } = req.query;
    const user = await User.findOne({ verification_token: token });

    if (!user) {
      return res.status(400).json({
        error: "Invalid token, please contact admin",
      });
    }

    user.is_email_verified = true;
    user.verification_token += " Verified";
    await user.save();

    // Render the successful activation page using EJS
    const viewPath = path.join(
      __dirname,
      "../views/emailActivationSuccess.ejs",
    );
    const html = await ejs.renderFile(viewPath);

    res.status(200).send(html);
  } catch (error) {
    next(error);
  }
};

//just testing Ejs Pages
exports.ejsPage = async (req, res, next) => {
  console.log("EJS Page Test");
  const viewPath = path.join(__dirname, "../views/emailActivationSuccess.ejs");
  const html = await ejs.renderFile(viewPath);

  res.status(200).send(html);
};

exports.verifySuccess = async (req, res, next) => {
  console.log("Successful Activation");
  res.send("Thank you for verifying your email!");
};

//
//Get All Users
exports.getUsers = async (req, res, next) => {
  console.log("get users handler");
  const users = await User.find({}).sort({ createdAt: -1 });
  res.status(200).json(users);
};

//get a Single user
exports.getUser = async (req, res, next) => {
  console.log("get a user ");
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: "No such data:id" });
  }
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ error: "No user Found" });
  }

  res.status(200).json(user);
};
//

//Update user
exports.updateUser = async (req, res, next) => {
  console.log("update a user ");
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: "No such data:id" });
  }

  const user = await User.findOneAndUpdate(
    { _id: id },
    {
      ...req.body,
    },
  );
  if (!user) {
    return res.status(400).json({ error: "No data Found" });
  }

  res.status(200).json(user);
  console.log(id);
};
//
//Delete a user
exports.deleteUser = async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: "No such data:id" });
  }

  const user = await User.findOneAndDelete({ _id: id });
  if (!user) {
    return res.status(400).json({ error: "No user Found" });
  }

  res.status(200).json(user);
};
