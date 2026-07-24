const response = await fetch('http://localhost:3050/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'testop@phase3.com',
    password: 'operator123'
  })
});
const data = await response.json();
console.log(response.status, data);
