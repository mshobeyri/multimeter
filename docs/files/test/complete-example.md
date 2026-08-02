# Complete example
```yaml
type: test
title: Login + Profile
import:
  users: ./users.csv
inputs:
  user: string
  pass: string
steps:
  - call: login
    id: doLogin
    inputs:
      username: i:user
      password: i:pass
  - assert: ${doLogin.status} == 200
  - set:
      token: ${doLogin.token}
  - delay: 2s
  - call: getUser
    id: me
    inputs:
      token: ${token}
  - check: ${me.email} =* /@example.com$/
```
