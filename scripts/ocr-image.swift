import AppKit
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 2 else {
    fputs("usage: swift ocr-image.swift <image-path>\n", stderr)
    exit(2)
}

let imagePath = args[1]
guard let image = NSImage(contentsOfFile: imagePath) else {
    fputs("cannot read image: \(imagePath)\n", stderr)
    exit(1)
}

var rect = CGRect(origin: .zero, size: image.size)
guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
    fputs("cannot create CGImage: \(imagePath)\n", stderr)
    exit(1)
}

let semaphore = DispatchSemaphore(value: 0)
var observationsPayload: [[String: Any]] = []
var requestError: Error?

let request = VNRecognizeTextRequest { request, error in
    requestError = error
    if let observations = request.results as? [VNRecognizedTextObservation] {
        observationsPayload = observations.compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }
            let box = observation.boundingBox
            let pixelX = box.minX * CGFloat(cgImage.width)
            let pixelY = (1 - box.maxY) * CGFloat(cgImage.height)
            let pixelWidth = box.width * CGFloat(cgImage.width)
            let pixelHeight = box.height * CGFloat(cgImage.height)
            return [
                "text": candidate.string,
                "confidence": candidate.confidence,
                "box": [
                    "x": box.minX,
                    "y": 1 - box.maxY,
                    "width": box.width,
                    "height": box.height
                ],
                "pixelBox": [
                    "x": pixelX,
                    "y": pixelY,
                    "width": pixelWidth,
                    "height": pixelHeight
                ]
            ]
        }
    }
    semaphore.signal()
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
    _ = semaphore.wait(timeout: .now() + 30)
} catch {
    fputs(error.localizedDescription + "\n", stderr)
    exit(1)
}

if let requestError {
    fputs(requestError.localizedDescription + "\n", stderr)
    exit(1)
}

let payload: [String: Any] = [
    "image": [
        "path": imagePath,
        "width": cgImage.width,
        "height": cgImage.height
    ],
    "observations": observationsPayload
]

let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
print("")
