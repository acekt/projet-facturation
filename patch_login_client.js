const fs = require('fs');
let code = fs.readFileSync('app/login/login-client.tsx', 'utf8');

// Replace the useTransition usage
code = code.replace(
  /const \[isPending, startSubmitTransition\] = React\.useTransition\(\)/,
  `` // Remove it entirely
);

// We still need router.push which is inside the handleLogin, let's just replace the whole handleLogin block
code = code.replace(
  /const handleLogin = \(e: React\.FormEvent\) => \{[\s\S]*?\n  \}/,
  `const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()

      if (res.ok) {
        toast.success("Connexion réussie. Bienvenue dans Facturier !")
        setUser(data.user)
        await new Promise(resolve => setTimeout(resolve, 250))
        router.push('/')
        router.refresh()
      } else {
        toast.error(data.error || "Identifiants invalides")
      }
    } catch (err) {
      toast.error("Impossible de joindre le serveur local")
    } finally {
      setIsSubmitting(false)
    }
  }`
);

// Replace disabled={isPending || isSubmitting} with disabled={isSubmitting} in all JSX elements
code = code.replace(/disabled=\{isPending \|\| isSubmitting\}/g, "disabled={isSubmitting}");
// Replace (isPending || isSubmitting) with isSubmitting
code = code.replace(/\(isPending \|\| isSubmitting\)/g, "isSubmitting");

fs.writeFileSync('app/login/login-client.tsx', code);
