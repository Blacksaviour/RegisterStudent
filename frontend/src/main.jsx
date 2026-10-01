import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  isAddress,
} from 'viem'
import './styles.css'

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS
const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545'
const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31337)

const registryChain = {
  id: chainId,
  name: chainId === 11155111 ? 'Sepolia' : chainId === 31337 ? 'Anvil Local' : 'Student Registry Network',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 751532,
    },
  },
}

const registryAbi = [
  {
    type: 'function', name: 'register', stateMutability: 'nonpayable',
    inputs: [
      { name: '_name', type: 'string' },
      { name: '_age', type: 'uint256' },
      { name: '_course', type: 'string' },
    ], outputs: [],
  },
  {
    type: 'function', name: 'registered', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'studentCount', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'getStudentAddress', stateMutability: 'view',
    inputs: [{ name: '_index', type: 'uint256' }], outputs: [{ type: 'address' }],
  },
  {
    type: 'function', name: 'getStudent', stateMutability: 'view',
    inputs: [{ name: '_student', type: 'address' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'age', type: 'uint256' },
      { name: 'course', type: 'string' },
    ],
  },
]

const publicClient = createPublicClient({ chain: registryChain, transport: http(rpcUrl) })

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function readableError(error) {
  return error?.shortMessage || error?.message?.split('\n')[0] || 'Something went wrong.'
}

function App() {
  const [account, setAccount] = useState('')
  const [walletClient, setWalletClient] = useState(null)
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({ name: '', age: '', course: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Connect a wallet to join the registry.')
  const [error, setError] = useState('')

  const refreshStudents = async () => {
    if (!isAddress(contractAddress || '')) return
    try {
      const count = await publicClient.readContract({ address: contractAddress, abi: registryAbi, functionName: 'studentCount' })
      const indexes = Array.from({ length: Number(count) }, (_, index) => BigInt(index))
      if (!indexes.length) {
        setStudents([])
        return
      }

      const addresses = await publicClient.multicall({
        contracts: indexes.map((index) => ({ address: contractAddress, abi: registryAbi, functionName: 'getStudentAddress', args: [index] })),
        allowFailure: false,
      })
      const records = await publicClient.multicall({
        contracts: addresses.map((studentAddress) => ({ address: contractAddress, abi: registryAbi, functionName: 'getStudent', args: [studentAddress] })),
        allowFailure: false,
      })
      setStudents(records.map((record, index) => ({ address: addresses[index], name: record[0], age: record[1].toString(), course: record[2] })))
    } catch (loadError) {
      const message = readableError(loadError)
      setError(message.includes('studentCount')
        ? 'This deployed contract does not include studentCount(). Redeploy the updated StudentRegistration contract, then update VITE_CONTRACT_ADDRESS.'
        : message)
    }
  }

  const refreshProfile = async (address = account) => {
    if (!address || !isAddress(contractAddress || '')) {
      setProfile(null)
      return
    }
    try {
      const isRegistered = await publicClient.readContract({ address: contractAddress, abi: registryAbi, functionName: 'registered', args: [address] })
      if (!isRegistered) {
        setProfile(null)
        return
      }
      const record = await publicClient.readContract({ address: contractAddress, abi: registryAbi, functionName: 'getStudent', args: [address] })
      setProfile({ name: record[0], age: record[1].toString(), course: record[2] })
    } catch (loadError) {
      setError(readableError(loadError))
    }
  }

  useEffect(() => {
    refreshStudents()
  }, [])

  useEffect(() => {
    refreshProfile()
  }, [account])

  const connectWallet = async () => {
    setError('')
    if (!window.ethereum) {
      setError('Install a browser wallet such as MetaMask to continue.')
      return
    }
    try {
      const client = createWalletClient({ chain: registryChain, transport: custom(window.ethereum) })
      const [address] = await client.requestAddresses()
      setWalletClient(client)
      setAccount(address)
      setMessage('Wallet connected. Your profile is ready to check.')
    } catch (walletError) {
      setError(readableError(walletError))
    }
  }

  const submitRegistration = async (event) => {
    event.preventDefault()
    setError('')
    if (!walletClient || !account) {
      setError('Connect your wallet before registering.')
      return
    }
    if (!form.name.trim() || !form.course.trim() || !form.age || Number(form.age) < 1) {
      setError('Enter a name, a valid age, and a course.')
      return
    }
    setLoading(true)
    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: registryAbi,
        functionName: 'register',
        args: [form.name.trim(), BigInt(form.age), form.course.trim()],
        account,
      })
      setMessage('Registration submitted. Waiting for confirmation...')
      await publicClient.waitForTransactionReceipt({ hash })
      setForm({ name: '', age: '', course: '' })
      setMessage('You are registered. Your profile is now visible in the directory.')
      await Promise.all([refreshProfile(), refreshStudents()])
    } catch (writeError) {
      setError(readableError(writeError))
    } finally {
      setLoading(false)
    }
  }

  const configured = isAddress(contractAddress || '')

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Student<span>Registry</span></a>
        <button className="connect-button" onClick={connectWallet}>
          <span className="wallet-dot" />
          {account ? shortAddress(account) : 'Connect wallet'}
        </button>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">ON-CHAIN DIRECTORY / {students.length.toString().padStart(2, '0')} STUDENTS</p>
          <h1>Make your place<br /><em>in the register.</em></h1>
          <p className="lede">A simple, transparent student directory powered by your wallet and the StudentRegistration contract.</p>
        </div>
        <div className="network-stamp"><span className="pulse" /> {registryChain.name}<br /><small>{rpcUrl}</small></div>
      </section>

      {!configured && <div className="notice">Set <code>VITE_CONTRACT_ADDRESS</code> in <code>frontend/.env</code> to connect this interface to your deployed contract.</div>}
      {error && <div className="alert">{error}</div>}

      <section className="workspace-grid">
        <div className="left-column">
          <section className="panel register-panel">
            <div className="panel-heading"><span className="panel-number">01</span><div><p className="section-label">NEW ENTRY</p><h2>Register as a student</h2></div></div>
            <form onSubmit={submitRegistration}>
              <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ada Lovelace" /></label>
              <div className="form-row"><label>Age<input type="number" min="1" max="150" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} placeholder="36" /></label><label>Course<input value={form.course} onChange={(event) => setForm({ ...form, course: event.target.value })} placeholder="Computer Science" /></label></div>
              <button className="primary-button" disabled={loading || !configured}>{loading ? 'Confirming...' : 'Add my profile'}<span>↗</span></button>
            </form>
            <p className="form-status">{message}</p>
          </section>

          <section className="panel profile-panel">
            <div className="panel-heading"><span className="panel-number">02</span><div><p className="section-label">YOUR ACCOUNT</p><h2>Your student profile</h2></div></div>
            {profile ? <div className="profile-card"><div className="avatar">{profile.name.charAt(0).toUpperCase()}</div><div><h3>{profile.name}</h3><p>{profile.course} <span>/</span> {profile.age} years old</p><code>{shortAddress(account)}</code></div></div> : <div className="empty-state">{account ? 'This wallet has not registered yet.' : 'Connect your wallet to view your profile.'}</div>}
          </section>
        </div>

        <section className="panel directory-panel">
          <div className="directory-heading"><div className="panel-heading"><span className="panel-number">03</span><div><p className="section-label">PUBLIC DIRECTORY</p><h2>Registered students</h2></div></div><button className="refresh-button" onClick={() => refreshStudents()} aria-label="Refresh student directory">↻</button></div>
          <p className="directory-note">Every profile is read from the contract in a multicall batch.</p>
          <div className="student-list">{students.length ? students.map((student, index) => <article className="student-row" key={student.address}><span className="row-index">{String(index + 1).padStart(2, '0')}</span><div className="student-initial">{student.name.charAt(0).toUpperCase()}</div><div className="student-info"><h3>{student.name}</h3><p>{student.course}</p></div><div className="student-meta"><strong>{student.age}</strong><span>years</span></div><code>{shortAddress(student.address)}</code></article>) : <div className="empty-directory">{error ? 'Directory unavailable for this contract deployment.' : 'No registered students yet.'}</div>}</div>
        </section>
      </section>
      <footer><span>STUDENT REGISTRATION / VITE + VIEM</span><span>READ ONLY DIRECTORY · {students.length} PROFILES</span></footer>
    </main>
  )
}

const root = globalThis.__studentRegistryRoot || createRoot(document.getElementById('root'))
globalThis.__studentRegistryRoot = root
root.render(<StrictMode><App /></StrictMode>)