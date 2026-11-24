
const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("¿Cómo te llamas? ", (nombre) => {
  rl.question("¿Cuántos años tienes? ", (respuesta) => {
    const edad = Number(respuesta);
    const anioActual = new Date().getFullYear();

    if (!Number.isInteger(edad) || edad < 0) {
      console.log("Por favor, escribe una edad válida.");
    } else {
      const edadEn2030 = edad + (2030 - anioActual);

      console.log(
        `¡Hola, ${nombre}! Sabías que en 2030 vas a tener ${edadEn2030} años?`
      );
    }

    rl.close();
  });
});
