
"use client";

import { useState } from 'react';
import { FiSave, FiEdit, FiTrash2, FiCreditCard, FiMail, FiAlertTriangle } from 'react-icons/fi';

// A placeholder component for a single configuration setting
const SettingRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-200">
    <span className="text-gray-600 font-medium">{label}</span>
    <div>{children}</div>
  </div>
);

// Main page component for Settings
export default function SettingsPage() {
  const [companyName, setCompanyName] = useState("Track v1 Inc.");
  const [isEditingName, setIsEditingName] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500">Manage your account and organization settings.</p>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        {/* Company Details Section */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Company Details</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <span className="text-gray-600 font-medium">Company Name</span>
                {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input 
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="border-gray-300 rounded-md shadow-sm px-3 py-1"
                      />
                      <button 
                          onClick={() => setIsEditingName(false)} 
                          className="p-2 text-green-600 hover:text-green-700"
                      >
                          <FiSave />
                      </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-800">{companyName}</span>
                      <button 
                          onClick={() => setIsEditingName(true)} 
                          className="p-2 text-gray-500 hover:text-indigo-600"
                      >
                          <FiEdit />
                      </button>
                    </div>
                )}
            </div>
            <SettingRow label="Subscription Plan">
              <div className="flex items-center gap-2">
                <span className="text-gray-800 font-semibold">Pro Plan</span>
                <button className="text-indigo-600 hover:underline">Manage Plan</button>
              </div>
            </SettingRow>
          </div>
        </section>

        {/* Billing Information Section */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FiCreditCard className="text-indigo-600" />
            Billing
          </h2>
          <div className="space-y-4">
             <SettingRow label="Payment Method">
                <div className="flex items-center gap-2">
                  <span className="text-gray-800">Visa ending in 4242</span>
                  <button className="text-indigo-600 hover:underline">Update</button>
                </div>
            </SettingRow>
            <SettingRow label="Billing Email">
                <div className="flex items-center gap-2">
                  <FiMail className="text-gray-400" />
                  <span className="text-gray-800">contact@trackv1.com</span>
                </div>
            </SettingRow>
          </div>
        </section>

        {/* Danger Zone Section */}
        <section className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <h2 className="text-xl font-semibold text-red-600 mb-4 flex items-center gap-2">
            <FiAlertTriangle />
            Danger Zone
          </h2>
          <div>
            <SettingRow label="Delete Company Data">
              <button className="bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600 flex items-center gap-2">
                <FiTrash2 />
                Delete All Data
              </button>
            </SettingRow>
          </div>
        </section>
      </main>
    </div>
  );
}