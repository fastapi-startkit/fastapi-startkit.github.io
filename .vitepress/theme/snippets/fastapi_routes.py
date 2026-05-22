# routes/web.py
from fastapi_startkit.fastapi import Router

router = Router()

from app.http.controllers import users_controller

router.get("users", users_controller.index)
router.post("users", users_controller.store)
router.get("users/{user_id}", users_controller.show)
router.put("users/{user_id}", users_controller.update)
router.delete("users/{user_id}", users_controller.destroy)
