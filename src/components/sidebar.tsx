import Link from 'next/link';
import React from 'react';

const Sidebar: React.FC = () => {
    return (
        <aside style={{ width: '200px', background: '#f4f4f4', height: '100vh', padding: '1rem' }}>
            <nav>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                   
                    <li style={{ marginBottom: '1rem' }}>
                        <Link href="/dashboard/students" style={{ textDecoration: 'none', color: '#333' }}>
                            Student
                        </Link>
                    </li>
                    <li>
                        <Link href="/dashboard/attendance" style={{ textDecoration: 'none', color: '#333' }}>
                            Attendance
                        </Link>
                    </li>
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar;
