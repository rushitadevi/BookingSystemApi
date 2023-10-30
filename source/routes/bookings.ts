import express from "express";
import controller from "../controllers/bookings";
const router = express.Router();

router.get("/", controller.healthCheck);
router.post("/api/v1/booking/", controller.createBooking);
router.put("/api/v1/booking/extend/", controller.extendBooking);

export = router;
