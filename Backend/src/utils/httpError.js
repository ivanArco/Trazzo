// Error con código HTTP: los servicios lo lanzan y el manejador de errores lo responde
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
