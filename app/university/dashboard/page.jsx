"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { BACKEND_URL } from "../../../lib/config";
import "remixicon/fonts/remixicon.css";

const UniversityDashboard = () => {
  const [university, setUniversity] = useState(null);
  const [students, setStudents] = useState([]);
  const [issuedCredentials, setIssuedCredentials] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [credentialTitle, setCredentialTitle] = useState("");
  const [credentialFile, setCredentialFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [revoking, setRevoking] = useState(null); // Track which credential is being revoked
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [credentialToRevoke, setCredentialToRevoke] = useState(null);
  const [blockchainStatus, setBlockchainStatus] = useState({ connected: false, balance: '0' });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const verifyAndLoadData = async () => {
      const token = localStorage.getItem('proofly_university_token');
      if (!token) {
        router.push('/university/login');
        return;
      }

      try {
        const uniResponse = await fetch(`${BACKEND_URL}/api/university/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
        const uniData = await uniResponse.json();
        
        if (uniData.valid) {
          setUniversity(uniData.university);

          // Fetch students of the university
          const studentsResponse = await fetch(`${BACKEND_URL}/api/university/students`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });
          const studentsData = await studentsResponse.json();
          setStudents(studentsData);

          // Fetch issued credentials
          const credentialsResponse = await fetch(`${BACKEND_URL}/api/credentials/university`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });
          const credentialsData = await credentialsResponse.json();
          setIssuedCredentials(credentialsData);

          // Fetch blockchain status
          try {
            const blockchainResponse = await fetch(`${BACKEND_URL}/api/credentials/blockchain-status`);
            const blockchainData = await blockchainResponse.json();
            setBlockchainStatus(blockchainData);
          } catch (blockchainError) {
            console.error('Failed to fetch blockchain status:', blockchainError);
            setBlockchainStatus({ connected: false, error: 'Connection failed' });
          }

        } else {
          localStorage.removeItem('proofly_university_token');
          router.push('/university/login');
        }
      } catch (error) {
        console.error('Error:', error);
        localStorage.removeItem('proofly_university_token');
        router.push('/university/login');
      } finally {
        setLoading(false);
      }
    };

    verifyAndLoadData();
  }, [router]);

  // Cleanup image preview URL when component unmounts or when file changes
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, []);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('proofly_university_token');
    router.push('/');
  };

  const handleStudentSelect = (studentId) => {
    setSelectedStudent(studentId);
    setIsDropdownOpen(false);
  };
  
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      setCredentialFile(file);
      
      if (file.type.startsWith('image/')) {
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview);
        }
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
      } else {
        setImagePreview(null);
      }
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    const title = credentialTitle;
    const file = credentialFile;

    if (!title || !file || !selectedStudent) {
      toast.error("Please provide student, title and a file.");
      return;
    }

    setIssuing(true);
    const formData = new FormData();
    formData.append('studentId', selectedStudent);
    formData.append('title', title);
    formData.append('credential', file);

    try {
      const token = localStorage.getItem('proofly_university_token');
      const response = await fetch(`${BACKEND_URL}/api/credentials/issue`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Successfully issued credential "${title}"`);
        
        setSelectedStudent("");
        setCredentialTitle("");
        setCredentialFile(null);
        setFileName("");
        setIsDropdownOpen(false);
        
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);

        const credentialsResponse = await fetch(`${BACKEND_URL}/api/credentials/university`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const credentialsData = await credentialsResponse.json();
        setIssuedCredentials(credentialsData);

      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Issuing credential error:", error);
      toast.error("An error occurred while issuing the credential.");
    } finally {
      setIssuing(false);
    }
  };

  const handleRevokeClick = (credential) => {
    setCredentialToRevoke(credential);
    setShowConfirmDialog(true);
  };

  const handleConfirmRevoke = async () => {
    if (!credentialToRevoke) return;

    setRevoking(credentialToRevoke._id);
    setShowConfirmDialog(false);

    try {
      const token = localStorage.getItem('proofly_university_token');
      const response = await fetch(`${BACKEND_URL}/api/credentials/revoke/${credentialToRevoke._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Successfully revoked credential "${credentialToRevoke.title}"`);
        
        setIssuedCredentials(prev => prev.filter(cred => cred._id !== credentialToRevoke._id));
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Revoking credential error:", error);
      toast.error("An error occurred while revoking the credential.");
    } finally {
      setRevoking(null);
      setCredentialToRevoke(null);
    }
  };

  const handleCancelRevoke = () => {
    setShowConfirmDialog(false);
    setCredentialToRevoke(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-inter">
        <header className="border-b border-white/10 backdrop-blur-sm bg-black/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="h-6 w-16 bg-white/10 rounded animate-pulse"></div>
                <span className="text-[#666666]">|</span>
                <div className="h-4 w-28 bg-white/10 rounded animate-pulse"></div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-1"></div>
                  <div className="h-3 w-24 bg-white/10 rounded animate-pulse"></div>
                </div>
                <div className="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-12 bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-white/10 rounded-full animate-pulse"></div>
                <div>
                  <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-24 bg-white/10 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="flex items-center space-x-8">
                <div className="h-3 w-20 bg-white/10 rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-white/10 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 sticky top-28">
                <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-2"></div>
                <div className="h-4 w-64 bg-white/10 rounded animate-pulse mb-8"></div>
                
                                 <div className="space-y-6">
                   <div>
                     <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-2"></div>
                     <div className="h-10 w-full bg-white/10 rounded-lg animate-pulse relative">
                       <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white/5 rounded animate-pulse"></div>
                     </div>
                   </div>

                  <div>
                    <div className="h-4 w-28 bg-white/10 rounded animate-pulse mb-2"></div>
                    <div className="h-10 w-full bg-white/10 rounded-lg animate-pulse"></div>
                  </div>

                  <div>
                    <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2"></div>
                    <div className="h-52 w-full bg-white/10 rounded-lg animate-pulse"></div>
                  </div>

                  <div className="h-12 w-full bg-white/10 rounded-lg animate-pulse"></div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-8">
                <div className="h-10 w-64 bg-white/10 rounded animate-pulse mb-4"></div>
                <div className="h-6 w-96 bg-white/10 rounded animate-pulse"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="h-60 w-full bg-white/10 animate-pulse relative">
                      <div className="absolute top-4 right-4 w-8 h-8 bg-white/10 rounded-full animate-pulse"></div>
                    </div>
                    <div className="p-6">
                      <div className="h-6 w-3/4 bg-white/10 rounded animate-pulse mb-4"></div>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-5 h-5 bg-white/10 rounded-full animate-pulse"></div>
                          <div className="h-4 w-32 bg-white/10 rounded animate-pulse"></div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-5 h-5 bg-white/10 rounded-full animate-pulse"></div>
                          <div className="h-4 w-40 bg-white/10 rounded animate-pulse"></div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-5 h-5 bg-white/10 rounded-full animate-pulse"></div>
                          <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
                        </div>
                        
                        <div className="pt-3 border-t border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
                            <div className="flex items-center space-x-2">
                              <div className="w-1.5 h-1.5 bg-white/10 rounded-full animate-pulse"></div>
                              <div className="h-3 w-16 bg-white/10 rounded animate-pulse"></div>
                            </div>
                          </div>
                          <div className="h-20 w-full bg-white/10 rounded-lg animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!university) return null;

  return (
    <div className="min-h-screen bg-black text-white font-inter">
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold">
                Proofly
              </Link>
              <span className="text-[#666666]">|</span>
              <span className="text-[#d0d0d0] sm:block hidden">University Portal</span>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm font-medium">{university.universityName}</p>
                <p className="text-xs text-[#999999]">{university.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center sm:space-x-2 cursor-pointer sm:px-4 px-3 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/20 rounded-full transition duration-300"
              >
                <i className="ri-logout-circle-line"></i>
                <span className="sm:block hidden">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[83rem] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {blockchainStatus.connected ? (
          <div className="mb-12 bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <div className="flex sm:flex-row flex-col sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/30"></div>
                <div>
                  <p className="text-white text-sm font-medium">Blockchain Connected</p>
                  <p className="text-[#999999] text-xs">Polygon Amoy • {blockchainStatus.balance}</p>
                </div>
              </div>
              <div className="flex sm:flex-row flex-col items-start sm:items-center sm:space-x-8 space-y-2 sm:space-y-0 text-xs text-[#999999]">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center">
                    <i className="ri-wallet-line text-xs"></i>
                  </div>
                  <span className="font-mono text-[#cccccc]">{blockchainStatus.walletAddress?.slice(0, 6)}...{blockchainStatus.walletAddress?.slice(-4)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center">
                    <i className="ri-database-line text-xs"></i>
                  </div>
                  <span className="text-[#cccccc]">{issuedCredentials.filter(c => c.blockchainTxHash).length} On-Chain</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-12 bg-white/[0.02] border border-red-500/10 rounded-2xl p-5">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/30"></div>
              <div>
                <p className="text-red-400 text-sm font-medium">Blockchain Disconnected</p>
                <p className="text-[#999999] text-xs">Credentials will be stored locally only</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 sticky top-28 hover:border-white/10 transition-all duration-300">
              <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-white to-[#cccccc] bg-clip-text text-transparent">Issue a New Credential</h2>
              <p className="text-[#999999] text-sm mb-8 leading-relaxed">Upload the document and provide a title to issue a new credential.</p>
              
              <form onSubmit={handleUpload} className="space-y-6">
                <div>
                  <label htmlFor="student" className="block text-sm font-medium text-[#cccccc] mb-2">Select Student</label>
                  <div ref={dropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full cursor-pointer bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f5e65e] transition-all text-left flex items-center justify-between hover:bg-white/8"
                    >
                      <span className={selectedStudent ? "text-white" : "text-[#999999]"}>
                        {selectedStudent ? 
                          students.find(s => s._id === selectedStudent)?.name + ' (' + students.find(s => s._id === selectedStudent)?.email + ')' : 
                          'Select a student'
                        }
                      </span>
                      <i className={`ri-arrow-down-s-line transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''} text-[#999999]`}></i>
                    </button>
                    
                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-black border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        <div 
                          onClick={() => handleStudentSelect('')}
                          className="px-4 py-3 text-[#999999] hover:bg-white/5 cursor-pointer transition-colors border-b border-white/10"
                        >
                          Select a student
                        </div>
                    {students.map((student) => (
                          <div
                            key={student._id}
                            onClick={() => handleStudentSelect(student._id)}
                            className={`px-4 py-3 text-white hover:bg-white/10 cursor-pointer transition-colors ${
                              selectedStudent === student._id ? 'bg-[#f5e65e]/10 border-l-4 border-[#f5e65e]' : ''
                            }`}
                          >
                            <div className="font-medium">{student.name}</div>
                            <div className="text-sm text-[#999999]">{student.email}</div>
                          </div>
                    ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-[#cccccc] mb-2">Credential Title</label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    value={credentialTitle}
                    onChange={(e) => setCredentialTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#f5e65e] transition-all hover:bg-white/8"
                    placeholder="e.g., Bachelor of Science"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-2">Credential Document</label>
                  <div 
                    className="relative flex items-center justify-center w-full h-52 bg-white/5 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/30 hover:bg-white/8 transition-all overflow-hidden"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/png, image/jpeg, image/jpg, application/pdf"
                    />
                    
                    {imagePreview ? (
                      <div className="relative w-full h-full group">
                        <Image
                          src={imagePreview}
                          alt="Certificate preview"
                          fill
                          className="object-contain opacity-95"
                        />
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <div className="text-center text-white">
                            <i className="ri-upload-cloud-2-line text-3xl mb-2"></i>
                            <p className="text-sm font-medium">Click to change file</p>
                            <p className="text-xs text-[#cccccc] mt-1">{fileName}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/10 flex items-center justify-center">
                          <i className="ri-upload-cloud-2-line text-2xl text-[#999999]"></i>
                        </div>
                        <p className="text-sm text-[#cccccc] font-medium mb-1">
                          {fileName || "Click to upload a file"}
                        </p>
                        <p className="text-xs text-[#999999]">PNG, JPG or PDF</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={issuing}
                  className="w-full py-3 cursor-pointer bg-[#d9c616] text-black font-semibold rounded-xl hover:bg-[#ffe600df] transition-all duration-200 flex items-center justify-center space-x-2 disabled:bg-[#999999] disabled:cursor-not-allowed shadow-sm"
                >
                  <i className={`ri-shield-check-line ${issuing ? 'animate-pulse' : ''}`}></i>
                  <span>{issuing ? "Issuing..." : "Issue Credential"}</span>
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 lg:px-0 px-4 ">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 bg-gradient-to-r from-white to-[#cccccc] bg-clip-text text-transparent">Issued Credentials</h1>
              <p className="text-base text-[#999999] leading-relaxed">A record of all credentials issued by {university.universityName}.</p>
            </div>
            
            {issuedCredentials.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {issuedCredentials.map((cred) => (
                  <div key={cred._id} className="group bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300">
                    <div className="h-60 w-full relative overflow-hidden bg-white/3">
                      <Image 
                        src={`${BACKEND_URL}/${cred.imagePath}`} 
                        alt={cred.title} 
                        fill 
                        className="object-cover transition-transform duration-500" 
                      />
                      <button
                        onClick={() => handleRevokeClick(cred)}
                        disabled={revoking === cred._id}
                        className="absolute top-4 right-4 w-8 h-8 bg-red-600/95 backdrop-blur-sm hover:bg-red-600 text-white rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg"
                        title={revoking === cred._id ? "Revoking..." : "Revoke Credential"}
                      >
                        <i className={`ri-delete-bin-line text-sm ${revoking === cred._id ? 'animate-pulse' : ''}`}></i>
                      </button>
                    </div>
                    <div className="p-6">
                      <h3 className="font-semibold text-base mb-4 leading-tight text-white">{cred.title}</h3>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center text-[#cccccc] text-sm">
                          <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center mr-3">
                            <i className="ri-user-line text-xs text-[#999999]"></i>
                          </div>
                          <span className="truncate">{cred.student.name}</span>
                        </div>
                        
                        <div className="flex items-center text-[#cccccc] text-sm">
                          <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center mr-3">
                            <i className="ri-mail-line text-xs text-[#999999]"></i>
                          </div>
                          <span className="truncate">{cred.student.email}</span>
                        </div>
                        
                        <div className="flex items-center text-[#cccccc] text-sm">
                          <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center mr-3">
                            <i className="ri-calendar-line text-xs text-[#999999]"></i>
                          </div>
                          <span>{new Date(cred.issueDate).toLocaleDateString()}</span>
                        </div>
                        
                        <div className="pt-3 border-t border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-[#cccccc]">Blockchain Status</span>
                            <div className="flex items-center space-x-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${cred.blockchainTxHash ? 'bg-green-500' : 'bg-[#666666]'}`}></div>
                              <span className="text-xs text-[#cccccc]">
                                {cred.blockchainTxHash ? 'Verified' : 'Legacy'}
                              </span>
                            </div>
                          </div>
                          
                          {cred.blockchainTxHash ? (
                            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#999999]">Network:</span>
                                <span className="text-[#cccccc]">Polygon Amoy</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#999999]">Transaction:</span>
                                <button
                                  onClick={() => window.open(`https://amoy.polygonscan.com/tx/${cred.blockchainTxHash}`, '_blank')}
                                  className="text-blue-400 cursor-pointer hover:text-blue-300 transition-colors flex items-center space-x-1"
                                >
                                  <span className="font-mono">{cred.blockchainTxHash.slice(0, 6)}...{cred.blockchainTxHash.slice(-4)}</span>
                                  <i className="ri-external-link-line"></i>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                              <p className="text-xs text-[#999999]">
                                This credential was issued before blockchain integration.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="w-22 h-22 mx-auto mb-6 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                  <i className="ri-file-list-3-line text-4xl text-[#999999]"></i>
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">No Credentials Issued Yet</h3>
                <p className="text-[#999999] max-w-sm mx-auto mb-8 leading-relaxed">
                  Start issuing credentials to students. They will appear here once created.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 px-4">
          <div className="bg-black border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                <i className="ri-delete-bin-line text-2xl text-red-400"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Revoke Credential</h3>
              <p className="text-[#999999] mb-8 leading-relaxed">
                Are you sure you want to revoke <span className="font-medium text-white">"{credentialToRevoke?.title}"</span> for {credentialToRevoke?.student.name}? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelRevoke}
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRevoke}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
        </div>
              )}
        <Toaster theme="dark" position="bottom-right" richColors />
      </div>
  );
};

export default UniversityDashboard; 