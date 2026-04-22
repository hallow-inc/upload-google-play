import fg from "fast-glob";
import * as core from "@actions/core";
import { TrackConfiguration, PossibleTrackConfiguration } from "./edits";

export async function validateUserFraction(userFraction: number | undefined): Promise<void> {
    if (userFraction != undefined) {
        // If userFraction was set, perform basic validation
        if (isNaN(userFraction)) {
            return Promise.reject(new Error(`'userFraction' must be a number! Got ${userFraction}`))
        }
        if (userFraction >= 1 || userFraction <= 0) {
            return Promise.reject(new Error(`'userFraction' must be between 0 and 1! Got ${userFraction}`))
        }
    }
}

export async function validateStatus(status: string | undefined, hasUserFraction: boolean): Promise<void> {
    // If status was set, perform basic validation
    if (status != 'completed' && status != 'inProgress' && status != 'halted' && status != 'draft') {
        return Promise.reject(new Error(`Invalid status provided! Must be one of 'completed', 'inProgress', 'halted', 'draft'. Got ${status ?? "undefined"}`))
    }

    // Validate userFraction is correct for the given status
    switch (status) {
        case 'completed':
        case 'draft':
            if (hasUserFraction) {
                return Promise.reject(new Error(`Status '${status}' does not support 'userFraction'`))
            }
            break
        case 'halted':
        case 'inProgress':
            if (!hasUserFraction) {
                return Promise.reject(new Error(`Status '${status}' requires a 'userFraction' to be set`))
            }
            break
    }
}

export async function validateInAppUpdatePriority(inAppUpdatePriority: number | undefined): Promise<void> {
    if (inAppUpdatePriority) {
        if (inAppUpdatePriority < 0 || inAppUpdatePriority > 5) {
            return Promise.reject(new Error('inAppUpdatePriority must be between 0 and 5, inclusive-inclusive'))
        }
    }
}

export async function validateReleaseFiles(releaseFile: string | undefined, releaseFiles: string[]): Promise<string[]> {
    if (releaseFile && releaseFiles.length > 0) {
        return Promise.reject(new Error(`Cannot set both 'releaseFile' and 'releaseFiles'. 'releaseFile' is deprecated — please migrate fully to 'releaseFiles'.`))
    }
    if (releaseFile) {
        core.warning(`WARNING!! 'releaseFile' is deprecated and will be removed in a future release. Please migrate to 'releaseFiles'`)
    }
    const patterns = releaseFiles.length > 0 ? releaseFiles : (releaseFile ? [releaseFile] : [])
    if (patterns.length === 0) {
        return Promise.reject(new Error(`You must provide 'releaseFiles' in your configuration`))
    }
    const files = await fg(patterns)
    if (!files.length) {
        return Promise.reject(new Error(`Unable to find any release file matching ${patterns.join(',')}`))
    }
    return files
}

export async function validateTracks(track: string | undefined, tracks: string[], trackConfigurations: PossibleTrackConfiguration[], status: string | undefined, userFraction: string | undefined): Promise<TrackConfiguration[]> {
    if (track && tracks.length > 0) {
        return Promise.reject(new Error(`Cannot set both 'track' and 'tracks'. 'track' is deprecated — please migrate fully to 'tracks'.`))
    }
    if (trackConfigurations.length > 0 && (track || tracks.length > 0)) {
        return Promise.reject(new Error(`Cannot set 'trackConfigurations' along with 'track' or 'tracks'.`))
    }
    if (trackConfigurations.length > 0) {
        if (status) {
            core.warning(`WARNING!! 'status' is unused when trackConfigurations are specified.`)
        }
        if (userFraction) {
            core.warning(`WARNING!! 'userFraction' is unused when trackConfigurations are specified.`)
        }

        for (const configuration of trackConfigurations) {
            if (!configuration.track || configuration.track === '') {
                return Promise.reject(new Error(`Each entry in 'trackConfigurations' must have a 'track' field`))
            }

            let userFractionFloat: number | undefined
            if (configuration.userFraction) {
                userFractionFloat = parseFloat(configuration.userFraction)
            } else {
                userFractionFloat = undefined
            }

            await validateUserFraction(userFractionFloat)
            await validateStatus(configuration.status, userFractionFloat != undefined && !isNaN(userFractionFloat))
        }

        return trackConfigurations.map(configuration => {
            let userFractionFloat: number | undefined
            if (configuration.userFraction) {
                userFractionFloat = parseFloat(configuration.userFraction)
            } else {
                userFractionFloat = undefined
            }
            return new TrackConfiguration(configuration.track, configuration.status, userFractionFloat)
        })
    }

    // Validate user fraction
    let userFractionFloat: number | undefined
    if (userFraction) {
        userFractionFloat = parseFloat(userFraction)
    } else {
        userFractionFloat = undefined
    }
    await validateUserFraction(userFractionFloat)

    // Validate release status
    await validateStatus(status, userFractionFloat != undefined && !isNaN(userFractionFloat))

    if (track) {
        core.warning(`WARNING!! 'track' is deprecated and will be removed in a future release. Please migrate to 'tracks'`)
        return [new TrackConfiguration(track, status!, userFractionFloat)]
    }
    if (tracks.length > 0) {
        return tracks.map(track => new TrackConfiguration(track, status!, userFractionFloat))
    }
    return [new TrackConfiguration('production', status!, userFractionFloat)]
}