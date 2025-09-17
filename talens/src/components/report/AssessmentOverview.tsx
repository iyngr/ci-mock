interface AssessmentOverviewProps {
    data: {
        assessmentName: string
        candidateName: string
        testDate: string
        email: string
        testTakerId: string
    }
}

export default function AssessmentOverview({ data }: AssessmentOverviewProps) {
    return (
        <div className="p-8 min-h-[800px] flex flex-col justify-center">
            {/* Header */}
            <div className="text-center mb-16">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                    Technical Assessment Report
                </h1>
                <div className="w-24 h-1 bg-blue-600 mx-auto"></div>
            </div>

            {/* Assessment Details */}
            <div className="space-y-12 max-w-2xl mx-auto">
                <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Assessment Name</h2>
                    <p className="text-3xl font-bold text-blue-600 bg-blue-50 py-4 px-6 rounded-lg">
                        {data.assessmentName}
                    </p>
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Candidate Name</h2>
                    <p className="text-3xl font-bold text-green-600 bg-green-50 py-4 px-6 rounded-lg">
                        {data.candidateName}
                    </p>
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Test Date</h2>
                    <p className="text-2xl font-semibold text-gray-800 bg-gray-50 py-4 px-6 rounded-lg">
                        {data.testDate}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-12">
                    <div className="text-center">
                        <h3 className="text-lg font-medium text-gray-600 mb-2">Email Address</h3>
                        <p className="text-xl font-semibold text-gray-800">{data.email}</p>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-medium text-gray-600 mb-2">Test Taker ID</h3>
                        <p className="text-xl font-semibold text-gray-800">{data.testTakerId}</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-16 text-center text-gray-500">
                <p className="text-sm">Generated on {new Date().toLocaleDateString()}</p>
            </div>
        </div>
    )
}
