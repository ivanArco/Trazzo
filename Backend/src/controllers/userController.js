import * as userService from '../services/userService.js';

// Express 5 envía al manejador de errores cualquier excepción de una función async
export const getUsers = async (req, res) => {
  const users = await userService.getUsers();
  res.status(200).json(users);
};

export const createUser = async (req, res) => {
  const newUser = await userService.createNewUser(req.body);
  res.status(201).json(newUser);
};
