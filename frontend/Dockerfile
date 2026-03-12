FROM node:20-alpine

WORKDIR /app

COPY package.json .

# Install dependencies, ignore peer conflicts for uiw/react-md-editor if any
RUN npm install --legacy-peer-deps

COPY . .

# Expose port 3000 mapping
EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
