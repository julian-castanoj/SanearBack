# Usa una imagen base de Node.js
FROM node:14

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de tu proyecto al contenedor
COPY . /app

# Instala las dependencias
RUN npm install

# Exponer el puerto en el que el backend va a escuchar
EXPOSE 3000

# Comando para ejecutar el servidor
CMD ["npm", "start"]